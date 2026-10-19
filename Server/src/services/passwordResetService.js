const crypto = require('crypto');
const bcrypt = require('bcrypt');
const pool = require('../config/database');


// =========================================================
// Configuration
// =========================================================

const RESET_TOKEN_EXPIRY_MINUTES = 30;


// =========================================================
// Generate secure password reset token
// =========================================================

const generateResetToken = () => {
    return crypto.randomBytes(32).toString('hex');
};


// =========================================================
// Hash reset token
// =========================================================

const hashResetToken = (token) => {
    return crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');
};


// =========================================================
// Request password reset
// =========================================================

const requestPasswordReset = async (email) => {

    const normalizedEmail =
        email.trim().toLowerCase();


    // -----------------------------------------------------
    // Find user
    // -----------------------------------------------------

    const userResult = await pool.query(
        `
            SELECT
                id,
                email,
                first_name,
                last_name,
                is_active

            FROM users

            WHERE LOWER(email) = $1
        `,
        [normalizedEmail]
    );


    /*
     * IMPORTANT:
     *
     * We deliberately return the same result whether
     * the account exists or not.
     *
     * This prevents attackers from discovering which
     * email addresses have Big Sammy accounts.
     */

    if (userResult.rows.length === 0) {
        return {
            email: normalizedEmail,
            resetToken: null
        };
    }


    const user = userResult.rows[0];


    /*
     * Do not issue reset tokens for deactivated accounts.
     *
     * We still return the same outward response.
     */

    if (!user.is_active) {
        return {
            email: normalizedEmail,
            resetToken: null
        };
    }


    // -----------------------------------------------------
    // Generate secure token
    // -----------------------------------------------------

    const resetToken =
        generateResetToken();


    const tokenHash =
        hashResetToken(resetToken);


    // -----------------------------------------------------
    // Calculate expiration
    // -----------------------------------------------------

    const expiresAt =
        new Date(
            Date.now() +
            RESET_TOKEN_EXPIRY_MINUTES *
            60 *
            1000
        );


    // -----------------------------------------------------
    // Invalidate previous unused tokens
    // -----------------------------------------------------

    await pool.query(
        `
            UPDATE password_reset_tokens

            SET
                used_at = CURRENT_TIMESTAMP

            WHERE user_id = $1
              AND used_at IS NULL
        `,
        [user.id]
    );


    // -----------------------------------------------------
    // Store hashed token
    // -----------------------------------------------------

    await pool.query(
        `
            INSERT INTO password_reset_tokens (
                user_id,
                token_hash,
                expires_at
            )

            VALUES (
                $1,
                $2,
                $3
            )
        `,
        [
            user.id,
            tokenHash,
            expiresAt
        ]
    );


    /*
     * The raw token is returned internally so the
     * controller/email layer can construct the reset link.
     *
     * It is NEVER stored in the database.
     */

    return {
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        resetToken,
        expiresAt
    };
};


// =========================================================
// Reset password
// =========================================================

const resetPassword = async (
    resetToken,
    newPassword
) => {

    if (!resetToken) {
        const error = new Error(
            'Password reset token is required'
        );

        error.statusCode = 400;

        throw error;
    }

    // -----------------------------------------------------
    // Validate password
    // -----------------------------------------------------

    if (
        typeof newPassword !== 'string' ||
        newPassword.length < 8
    ) {
        const error = new Error(
            'Password must be at least 8 characters long'
        );

        error.statusCode = 400;

        throw error;
    }

    // -----------------------------------------------------
    // Hash token received from customer
    // -----------------------------------------------------

    const tokenHash =
        hashResetToken(resetToken);

    // -----------------------------------------------------
    // Start transaction
    // -----------------------------------------------------

    const client = await pool.connect();

    try {

        await client.query('BEGIN');

        // -------------------------------------------------
        // Find and lock reset token
        // -------------------------------------------------

        /*
         * FOR UPDATE locks this specific token row while
         * the password reset transaction is running.
         *
         * This prevents two simultaneous requests from
         * successfully using the same reset token.
         */

        const tokenResult = await client.query(
            `
                SELECT
                    prt.id,
                    prt.user_id,
                    prt.token_hash,
                    prt.expires_at,
                    prt.used_at,

                    u.email,
                    u.is_active

                FROM password_reset_tokens prt

                INNER JOIN users u
                    ON u.id = prt.user_id

                WHERE prt.token_hash = $1

                FOR UPDATE
            `,
            [tokenHash]
        );

        // -------------------------------------------------
        // Verify token exists
        // -------------------------------------------------

        if (tokenResult.rows.length === 0) {

            const error = new Error(
                'Invalid or expired password reset token'
            );

            error.statusCode = 400;

            throw error;
        }

        const resetRecord =
            tokenResult.rows[0];

        // -------------------------------------------------
        // Prevent token reuse
        // -------------------------------------------------

        if (resetRecord.used_at) {

            const error = new Error(
                'This password reset token has already been used'
            );

            error.statusCode = 400;

            throw error;
        }

        // -------------------------------------------------
        // Check expiration
        // -------------------------------------------------

        if (
            new Date(resetRecord.expires_at) <=
            new Date()
        ) {

            const error = new Error(
                'Invalid or expired password reset token'
            );

            error.statusCode = 400;

            throw error;
        }

        // -------------------------------------------------
        // Check account status
        // -------------------------------------------------

        if (!resetRecord.is_active) {

            const error = new Error(
                'Your account has been deactivated'
            );

            error.statusCode = 403;

            throw error;
        }

        // -------------------------------------------------
        // Hash new password
        // -------------------------------------------------

        const passwordHash =
            await bcrypt.hash(
                newPassword,
                12
            );

        // -------------------------------------------------
        // Update password
        // -------------------------------------------------

        const userUpdateResult =
            await client.query(
                `
                    UPDATE users

                    SET
                        password = $1,
                        updated_at = CURRENT_TIMESTAMP

                    WHERE id = $2
                      AND is_active = TRUE

                    RETURNING
                        id,
                        email
                `,
                [
                    passwordHash,
                    resetRecord.user_id
                ]
            );

        if (
            userUpdateResult.rows.length === 0
        ) {

            const error = new Error(
                'Unable to reset password'
            );

            error.statusCode = 400;

            throw error;
        }

        // -------------------------------------------------
        // Mark current token as used
        // -------------------------------------------------

        const tokenUpdateResult =
            await client.query(
                `
                    UPDATE password_reset_tokens

                    SET
                        used_at = CURRENT_TIMESTAMP

                    WHERE id = $1
                      AND used_at IS NULL
                `,
                [resetRecord.id]
            );

        /*
         * This should normally affect exactly one row.
         *
         * If another process somehow consumed the token,
         * do not allow the password reset to continue.
         */

        if (tokenUpdateResult.rowCount !== 1) {

            const error = new Error(
                'This password reset token has already been used'
            );

            error.statusCode = 400;

            throw error;
        }

        // -------------------------------------------------
        // Invalidate other outstanding tokens
        // -------------------------------------------------

        await client.query(
            `
                UPDATE password_reset_tokens

                SET
                    used_at = CURRENT_TIMESTAMP

                WHERE user_id = $1
                  AND used_at IS NULL
                  AND id <> $2
            `,
            [
                resetRecord.user_id,
                resetRecord.id
            ]
        );

        // -------------------------------------------------
        // Commit transaction
        // -------------------------------------------------

        await client.query('COMMIT');

        return {
            userId: resetRecord.user_id,
            email: resetRecord.email
        };

    } catch (error) {

        await client.query('ROLLBACK');

        throw error;

    } finally {

        client.release();
    }
};


// =========================================================
// Cleanup expired/used tokens
// =========================================================

const cleanupPasswordResetTokens = async () => {

    const result = await pool.query(
        `
            DELETE FROM password_reset_tokens

            WHERE
                expires_at < CURRENT_TIMESTAMP

                OR

                used_at IS NOT NULL
        `
    );


    return {
        deletedCount: result.rowCount
    };
};


// =========================================================
// Exports
// =========================================================

module.exports = {
    requestPasswordReset,
    resetPassword,
    cleanupPasswordResetTokens
};