const pool = require('../config/database');

const getAllProducts = async (search, category, minPrice, maxPrice) => {
    let query = `
        SELECT
            p.id,
            p.name,
            p.slug,
            p.description,
            p.price,
            p.stock_quantity,
            p.sku,
            p.weight,
            p.is_available,
            p.created_at,
            c.id AS category_id,
            c.name AS category_name,
            c.slug AS category_slug
        FROM products p
        INNER JOIN categories c
            ON p.category_id = c.id
        WHERE p.is_available = TRUE
    `;

    const values = [];

    if (search) {
        values.push(`%${search}%`);

        query += `
            AND (
                p.name ILIKE $${values.length}
                OR p.description ILIKE $${values.length}
            )
        `;
    }

    if (category) {
        values.push(category);

        query += `
            AND c.slug = $${values.length}
        `;
    }

    if (minPrice) {
        values.push(minPrice);

        query += `
            AND p.price >= $${values.length}
        `;
    }

    if (maxPrice) {
        values.push(maxPrice);

        query += `
            AND p.price <= $${values.length}
        `;
    }

    query += ` ORDER BY p.created_at DESC`;

    const result = await pool.query(query, values);

    return result.rows;
};

const getProductById = async (productId) => {
    const result = await pool.query(
        `
        SELECT
            p.id,
            p.name,
            p.slug,
            p.description,
            p.price,
            p.stock_quantity,
            p.sku,
            p.weight,
            p.is_available,
            p.created_at,
            c.id AS category_id,
            c.name AS category_name,
            c.slug AS category_slug
        FROM products p
        INNER JOIN categories c
            ON p.category_id = c.id
        WHERE p.id = $1
        AND p.is_available = TRUE
        `,
        [productId]
    );

    if (result.rows.length === 0) {
        const error = new Error('Product not found');
        error.statusCode = 404;
        throw error;
    }

    return result.rows[0];
};

module.exports = {
    getAllProducts,
    getProductById,
};