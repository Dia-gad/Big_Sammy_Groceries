const bcrypt = require('bcrypt');
const pool = require('../config/database');


// ============================================================
// GET PROFILE
// ============================================================

const getProfile = async (userId) => {
    const result = await pool.query(
        `
        SELECT
            id,
            first_name,
            last_name,
            email,
            phone,
            role,
            is_active,
            created_at,
            updated_at
        FROM users
        WHERE id = $1
        `,
        [userId]
    );

    if (result.rowCount === 0) {
        const error = new Error('User account not found');
        error.statusCode = 404;
        throw error;
    }

    return result.rows[0];
};


// ============================================================
// UPDATE PROFILE
// ============================================================

const updateProfile = async ({
    userId,
    firstName,
    lastName,
    phone
}) => {
    const result = await pool.query(
        `
        UPDATE users
        SET
            first_name = $1,
            last_name = $2,
            phone = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING
            id,
            first_name,
            last_name,
            email,
            phone,
            role,
            is_active,
            created_at,
            updated_at
        `,
        [
            firstName,
            lastName,
            phone || null,
            userId
        ]
    );

    if (result.rowCount === 0) {
        const error = new Error('User account not found');
        error.statusCode = 404;
        throw error;
    }

    return result.rows[0];
};


// ============================================================
// CHANGE PASSWORD
// ============================================================

const changePassword = async ({
    userId,
    currentPassword,
    newPassword
}) => {
    const result = await pool.query(
        `
        SELECT password
        FROM users
        WHERE id = $1
        `,
        [userId]
    );

    if (result.rowCount === 0) {
        const error = new Error('User account not found');
        error.statusCode = 404;
        throw error;
    }

    const user = result.rows[0];

    const passwordMatches = await bcrypt.compare(
        currentPassword,
        user.password
    );

    if (!passwordMatches) {
        const error = new Error('Current password is incorrect');
        error.statusCode = 401;
        throw error;
    }

    const hashedPassword = await bcrypt.hash(
        newPassword,
        12
    );

    await pool.query(
        `
        UPDATE users
        SET
            password = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        `,
        [
            hashedPassword,
            userId
        ]
    );

    return {
        message: 'Password changed successfully'
    };
};


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    getProfile,
    updateProfile,
    changePassword
};