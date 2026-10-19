const pool = require('../config/database');


/**
 * Get high-level dashboard statistics.
 */
const getDashboardSummary = async () => {
    const result = await pool.query(`
        SELECT
            (
                SELECT COUNT(*)
                FROM users
                WHERE role = 'customer'
            ) AS total_customers,

            (
                SELECT COUNT(*)
                FROM users
                WHERE role = 'customer'
                  AND is_active = TRUE
            ) AS active_customers,

            (
                SELECT COUNT(*)
                FROM users
                WHERE role = 'customer'
                  AND is_active = FALSE
            ) AS inactive_customers,

            (
                SELECT COUNT(*)
                FROM orders
            ) AS total_orders,

            (
                SELECT COUNT(*)
                FROM orders
                WHERE status = 'pending'
            ) AS pending_orders,

            (
                SELECT COUNT(*)
                FROM orders
                WHERE status = 'processing'
            ) AS processing_orders,

            (
                SELECT COUNT(*)
                FROM orders
                WHERE status = 'delivered'
            ) AS delivered_orders,

            (
                SELECT COUNT(*)
                FROM orders
                WHERE status = 'cancelled'
            ) AS cancelled_orders,

            (
                SELECT COALESCE(SUM(total_amount), 0)
                FROM orders
                WHERE payment_status = 'paid'
            ) AS total_paid_revenue,

            (
                SELECT COALESCE(SUM(total_amount), 0)
                FROM orders
                WHERE payment_status = 'pending'
            ) AS pending_payment_amount,

            (
                SELECT COALESCE(SUM(amount), 0)
                FROM payment_refunds
                WHERE status = 'processed'
            ) AS total_refunded_amount
    `);

    return result.rows[0];
};


/**
 * Get sales overview.
 *
 * Optional:
 * - startDate
 * - endDate
 */
const getSalesOverview = async ({
    startDate = null,
    endDate = null
}) => {
    const values = [];

    const conditions = [
        `o.payment_status = 'paid'`
    ];

    if (startDate) {
        values.push(startDate);

        conditions.push(
            `o.created_at >= $${values.length}::date`
        );
    }

    if (endDate) {
        values.push(endDate);

        conditions.push(
            `o.created_at < ($${values.length}::date + INTERVAL '1 day')`
        );
    }

    const whereClause = conditions.join(' AND ');

    const result = await pool.query(
        `
        SELECT
            COUNT(*)::INTEGER AS paid_orders,

            COALESCE(
                SUM(o.total_amount),
                0
            ) AS gross_sales,

            COALESCE(
                SUM(o.delivery_fee),
                0
            ) AS delivery_fees,

            COALESCE(
                SUM(o.subtotal),
                0
            ) AS merchandise_sales,

            COALESCE(
                AVG(o.total_amount),
                0
            ) AS average_order_value

        FROM orders o

        WHERE ${whereClause}
        `,
        values
    );

    return result.rows[0];
};


/**
 * Get top-selling products.
 *
 * Only paid orders are included.
 */
const getTopSellingProducts = async ({
    limit = 10,
    startDate = null,
    endDate = null
}) => {
    const values = [];

    const conditions = [
        `o.payment_status = 'paid'`
    ];

    if (startDate) {
        values.push(startDate);

        conditions.push(
            `o.created_at >= $${values.length}::date`
        );
    }

    if (endDate) {
        values.push(endDate);

        conditions.push(
            `o.created_at < ($${values.length}::date + INTERVAL '1 day')`
        );
    }

    const parsedLimit = Number(limit);

    const safeLimit =
        Number.isInteger(parsedLimit) &&
        parsedLimit > 0 &&
        parsedLimit <= 100
            ? parsedLimit
            : 10;

    values.push(safeLimit);

    const limitParameter = `$${values.length}`;

    const whereClause = conditions.join(' AND ');

    const result = await pool.query(
        `
        SELECT
            oi.variant_id,

            p.id AS product_id,

            p.name AS product_name,

            pv.sku,

            SUM(oi.quantity)::INTEGER AS units_sold,

            COALESCE(
                SUM(oi.subtotal),
                0
            ) AS revenue

        FROM order_items oi

        INNER JOIN orders o
            ON o.id = oi.order_id

        INNER JOIN product_variants pv
            ON pv.id = oi.variant_id

        INNER JOIN products p
            ON p.id = pv.product_id

        WHERE ${whereClause}

        GROUP BY
            oi.variant_id,
            p.id,
            p.name,
            pv.sku

        ORDER BY
            units_sold DESC,
            revenue DESC

        LIMIT ${limitParameter}
        `,
        values
    );

    return result.rows;
};


/**
 * Get low-stock products.
 *
 * Default threshold: 10
 */
const getLowStockProducts = async ({
    threshold = 10
}) => {
    const parsedThreshold = Number(threshold);

    const safeThreshold =
        Number.isInteger(parsedThreshold) &&
        parsedThreshold >= 0 &&
        parsedThreshold <= 100000
            ? parsedThreshold
            : 10;

    const result = await pool.query(
        `
        SELECT
            pv.id AS variant_id,

            p.id AS product_id,

            p.name AS product_name,

            pv.sku,

            pu.name AS unit_name,

            pv.price,

            pv.stock_quantity,

            pv.is_available

        FROM product_variants pv

        INNER JOIN products p
            ON p.id = pv.product_id

        INNER JOIN product_units pu
            ON pu.id = pv.unit_id

        WHERE pv.stock_quantity <= $1

        ORDER BY
            pv.stock_quantity ASC,
            p.name ASC
        `,
        [safeThreshold]
    );

    return result.rows;
};


/**
 * Get recent orders.
 *
 * Returns the latest orders for the admin dashboard.
 *
 * Default limit: 10
 */
const getRecentOrders = async ({
    limit = 10
}) => {
    const parsedLimit = Number(limit);

    const safeLimit =
        Number.isInteger(parsedLimit) &&
        parsedLimit > 0 &&
        parsedLimit <= 100
            ? parsedLimit
            : 10;

    const result = await pool.query(
        `
        SELECT
            o.id AS order_id,

            o.order_number,

            o.user_id,

            CONCAT(
                u.first_name,
                ' ',
                u.last_name
            ) AS customer_name,

            u.email AS customer_email,

            o.status AS order_status,

            o.payment_status,

            o.fulfillment_method,

            o.subtotal,

            o.delivery_fee,

            o.total_amount,

            o.created_at,

            o.updated_at

        FROM orders o

        INNER JOIN users u
            ON u.id = o.user_id

        ORDER BY
            o.created_at DESC

        LIMIT $1
        `,
        [safeLimit]
    );

    return result.rows;
};


module.exports = {
    getDashboardSummary,
    getSalesOverview,
    getTopSellingProducts,
    getLowStockProducts,
    getRecentOrders
};