const pool = require('../config/database');

const CUSTOMER_ROLE = 'customer';

const getCustomers = async () => {
    const result = await pool.query(
        `SELECT
            u.id,
            u.first_name,
            u.last_name,
            u.email,
            u.phone,
            u.is_active,
            u.created_at,
            u.updated_at,
            COUNT(DISTINCT o.id)::INTEGER AS order_count,
            COALESCE(SUM(
                CASE
                    WHEN o.payment_status = 'paid'
                    THEN o.total_amount
                    ELSE 0
                END
            ), 0) AS total_spent
         FROM users u
         LEFT JOIN orders o
            ON o.user_id = u.id
         WHERE u.role = $1
         GROUP BY
            u.id,
            u.first_name,
            u.last_name,
            u.email,
            u.phone,
            u.is_active,
            u.created_at,
            u.updated_at
         ORDER BY u.created_at DESC`,
        [CUSTOMER_ROLE]
    );

    return result.rows;
};

const getCustomerById = async (userId) => {
    const result = await pool.query(
        `SELECT
            u.id,
            u.first_name,
            u.last_name,
            u.email,
            u.phone,
            u.is_active,
            u.created_at,
            u.updated_at,
            COUNT(DISTINCT o.id)::INTEGER AS order_count,
            COALESCE(SUM(
                CASE
                    WHEN o.payment_status = 'paid'
                    THEN o.total_amount
                    ELSE 0
                END
            ), 0) AS total_spent
         FROM users u
         LEFT JOIN orders o
            ON o.user_id = u.id
         WHERE u.id = $1
           AND u.role = $2
         GROUP BY
            u.id,
            u.first_name,
            u.last_name,
            u.email,
            u.phone,
            u.is_active,
            u.created_at,
            u.updated_at`,
        [userId, CUSTOMER_ROLE]
    );

    if (result.rowCount === 0) {
        const error = new Error('Customer not found');
        error.statusCode = 404;
        throw error;
    }

    return result.rows[0];
};

const changeCustomerStatus = async ({
    userId,
    isActive
}) => {
    const result = await pool.query(
        `UPDATE users
         SET
            is_active = $1,
            updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
           AND role = $3
         RETURNING
            id,
            first_name,
            last_name,
            email,
            phone,
            role,
            is_active,
            created_at,
            updated_at`,
        [isActive, userId, CUSTOMER_ROLE]
    );

    if (result.rowCount === 0) {
        const error = new Error('Customer not found');
        error.statusCode = 404;
        throw error;
    }

    return result.rows[0];
};

module.exports = {
    getCustomers,
    getCustomerById,
    changeCustomerStatus
};