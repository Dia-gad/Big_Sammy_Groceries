const pool = require('../config/database');

const getInventory = async ({
    search = null,
    movementType = null,
    lowStock = false
}) => {
    const values = [];
    const conditions = [];

    if (search) {
        values.push(`%${search}%`);
        conditions.push(`
            (
                p.name ILIKE $${values.length}
                OR p.sku ILIKE $${values.length}
            )
        `);
    }

    if (movementType) {
        values.push(movementType);
        conditions.push(`im.movement_type = $${values.length}`);
    }

    if (lowStock) {
        conditions.push(`p.stock_quantity <= 10`);
    }

    const whereClause = conditions.length
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

    const result = await pool.query(
        `
        SELECT
            p.id,
            p.name,
            p.sku,
            p.stock_quantity,
            p.is_available,
            c.name AS category_name,

            COUNT(im.id) AS movement_count,

            MAX(im.created_at) AS last_stock_activity

        FROM products p

        LEFT JOIN categories c
            ON c.id = p.category_id

        LEFT JOIN inventory_movements im
            ON im.product_id = p.id

        ${whereClause}

        GROUP BY
            p.id,
            p.name,
            p.sku,
            p.stock_quantity,
            p.is_available,
            c.name

        ORDER BY p.name ASC
        `,
        values
    );

    return result.rows;
};

const getProductInventoryHistory = async (productId) => {
    const productResult = await pool.query(
        `
        SELECT
            p.id,
            p.name,
            p.sku,
            p.stock_quantity,
            p.is_available
        FROM products p
        WHERE p.id = $1
        `,
        [productId]
    );

    if (productResult.rows.length === 0) {
        const error = new Error('Product not found');
        error.statusCode = 404;
        throw error;
    }

    const movementResult = await pool.query(
        `
        SELECT
            im.*,
            CONCAT(u.first_name, ' ', u.last_name) AS created_by_name
        FROM inventory_movements im
        LEFT JOIN users u
            ON u.id = im.created_by
        WHERE im.product_id = $1
        ORDER BY im.created_at DESC
        `,
        [productId]
    );

    return {
        product: productResult.rows[0],
        movements: movementResult.rows
    };
};

module.exports = {
    getInventory,
    getProductInventoryHistory
};