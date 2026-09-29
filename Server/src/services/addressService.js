const pool = require('../config/database');

const createAddress = async (
    userId,
    {
        label,
        recipient_name,
        phone,
        address_line,
        city,
        state,
        landmark,
        is_default
    }
) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const countResult = await client.query(
            `SELECT COUNT(*)::int AS count
             FROM customer_addresses
             WHERE user_id = $1`,
            [userId]
        );

        const addressCount = countResult.rows[0].count;

        const shouldBeDefault =
            addressCount === 0 || is_default === true;

        if (shouldBeDefault) {
            await client.query(
                `UPDATE customer_addresses
                 SET is_default = FALSE,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = $1`,
                [userId]
            );
        }

        const result = await client.query(
            `INSERT INTO customer_addresses (
                user_id,
                label,
                recipient_name,
                phone,
                address_line,
                city,
                state,
                landmark,
                is_default
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING
                id,
                label,
                recipient_name,
                phone,
                address_line,
                city,
                state,
                landmark,
                is_default,
                created_at,
                updated_at`,
            [
                userId,
                label || 'Home',
                recipient_name,
                phone,
                address_line,
                city,
                state,
                landmark || null,
                shouldBeDefault
            ]
        );

        await client.query('COMMIT');

        return result.rows[0];

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};


const getMyAddresses = async (userId) => {
    const result = await pool.query(
        `SELECT
            id,
            label,
            recipient_name,
            phone,
            address_line,
            city,
            state,
            landmark,
            is_default,
            created_at,
            updated_at
         FROM customer_addresses
         WHERE user_id = $1
         ORDER BY is_default DESC, created_at DESC`,
        [userId]
    );

    return result.rows;
};


const getAddressById = async (userId, addressId) => {
    const result = await pool.query(
        `SELECT
            id,
            label,
            recipient_name,
            phone,
            address_line,
            city,
            state,
            landmark,
            is_default,
            created_at,
            updated_at
         FROM customer_addresses
         WHERE id = $1
         AND user_id = $2`,
        [addressId, userId]
    );

    if (result.rows.length === 0) {
        const error = new Error('Address not found');
        error.statusCode = 404;
        throw error;
    }

    return result.rows[0];
};


const updateAddress = async (userId, addressId, data) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const existingAddress = await client.query(
            `SELECT id
             FROM customer_addresses
             WHERE id = $1
             AND user_id = $2`,
            [addressId, userId]
        );

        if (existingAddress.rows.length === 0) {
            const error = new Error('Address not found');
            error.statusCode = 404;
            throw error;
        }

        const {
            label,
            recipient_name,
            phone,
            address_line,
            city,
            state,
            landmark,
            is_default
        } = data;

        if (is_default === true) {
            await client.query(
                `UPDATE customer_addresses
                 SET is_default = FALSE,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = $1`,
                [userId]
            );
        }

        const result = await client.query(
            `UPDATE customer_addresses
             SET
                label = COALESCE($1, label),
                recipient_name = COALESCE($2, recipient_name),
                phone = COALESCE($3, phone),
                address_line = COALESCE($4, address_line),
                city = COALESCE($5, city),
                state = COALESCE($6, state),
                landmark = COALESCE($7, landmark),
                is_default = COALESCE($8, is_default),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $9
             AND user_id = $10
             RETURNING
                id,
                label,
                recipient_name,
                phone,
                address_line,
                city,
                state,
                landmark,
                is_default,
                created_at,
                updated_at`,
            [
                label ?? null,
                recipient_name ?? null,
                phone ?? null,
                address_line ?? null,
                city ?? null,
                state ?? null,
                landmark ?? null,
                is_default ?? null,
                addressId,
                userId
            ]
        );

        await client.query('COMMIT');

        return result.rows[0];

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};


const deleteAddress = async (userId, addressId) => {
    const result = await pool.query(
        `DELETE FROM customer_addresses
         WHERE id = $1
         AND user_id = $2
         RETURNING id, label`,
        [addressId, userId]
    );

    if (result.rows.length === 0) {
        const error = new Error('Address not found');
        error.statusCode = 404;
        throw error;
    }

    return result.rows[0];
};


module.exports = {
    createAddress,
    getMyAddresses,
    getAddressById,
    updateAddress,
    deleteAddress
};