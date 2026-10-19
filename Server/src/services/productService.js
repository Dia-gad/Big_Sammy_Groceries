const pool = require('../config/database');

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const handleDatabaseError = (error) => {
    if (error.code === '23505') {
        const duplicateError = new Error(
            'A product with the same slug or SKU already exists'
        );
        duplicateError.statusCode = 409;
        return duplicateError;
    }

    if (error.code === '23503') {
        const foreignKeyError = new Error(
            'The referenced category or unit does not exist'
        );
        foreignKeyError.statusCode = 400;
        return foreignKeyError;
    }

    return error;
};


/*
|--------------------------------------------------------------------------
| Customer Product Queries
|--------------------------------------------------------------------------
*/

/**
 * Get all publicly available products.
 */
const getAllProducts = async (
    search,
    category,
    minPrice,
    maxPrice,
    featured
) => {
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
            p.image_url,
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

    if (featured === 'true') {
    query += `
        AND p.is_featured = TRUE
    `;
}

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

    if (minPrice !== undefined && minPrice !== '') {
        values.push(minPrice);

        query += `
            AND p.price >= $${values.length}
        `;
    }

    if (maxPrice !== undefined && maxPrice !== '') {
        values.push(maxPrice);

        query += `
            AND p.price <= $${values.length}
        `;
    }

    query += `
        ORDER BY p.created_at DESC
    `;

    const result = await pool.query(query, values);

    return result.rows;
};


/**
 * Get one publicly available product.
 */
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
            p.image_url,
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


/*
|--------------------------------------------------------------------------
| Admin Product Management
|--------------------------------------------------------------------------
*/

/**
 * Create a product and its first purchasable variant.
 *
 * A product without a variant cannot properly participate
 * in the current cart/inventory architecture.
 */
const createProduct = async ({
    categoryId,
    name,
    slug,
    description = null,
    weight = null,

    // Initial variant
    unitId,
    sku,
    price,
    stockQuantity = 0,
    options = {},
    isFeatured = false
}) => {

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        /*
         * Verify category.
         */
        const categoryResult = await client.query(
            `
            SELECT id
            FROM categories
            WHERE id = $1
              AND is_active = TRUE
            `,
            [categoryId]
        );

        if (categoryResult.rowCount === 0) {
            const error = new Error(
                'Active product category not found'
            );
            error.statusCode = 404;
            throw error;
        }

        /*
         * Verify product unit.
         */
        const unitResult = await client.query(
            `
            SELECT id
            FROM product_units
            WHERE id = $1
            `,
            [unitId]
        );

        if (unitResult.rowCount === 0) {
            const error = new Error(
                'Product unit not found'
            );
            error.statusCode = 404;
            throw error;
        }

        /*
         * Create product.
         *
         * price/stock_quantity are retained for compatibility
         * with the existing product catalogue.
         *
         * The variant remains the operational inventory source.
         */
        const productResult = await client.query(
            `
            INSERT INTO products (
                category_id,
                name,
                slug,
                description,
                price,
                stock_quantity,
                sku,
                weight,
                is_available,
                is_featured
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE,$9)
            RETURNING *
            `,
            [
                categoryId,
                name.trim(),
                slug.trim().toLowerCase(),
                description,
                price,
                stockQuantity,
                sku.trim(),
                weight,
                isFeatured
            ]
        );

        const product = productResult.rows[0];

        /*
         * Create the initial product variant.
         */
        const variantResult = await client.query(
            `
            INSERT INTO product_variants (
                product_id,
                unit_id,
                sku,
                price,
                stock_quantity,
                is_available,
                options
            )
            VALUES (
                $1,$2,$3,$4,$5,TRUE,$6
            )
            RETURNING *
            `,
            [
                product.id,
                unitId,
                sku.trim(),
                price,
                stockQuantity,
                options
            ]
        );

        const variant = variantResult.rows[0];

        await client.query('COMMIT');

        return {
            product,
            variant
        };

    } catch (error) {
        await client.query('ROLLBACK');
        throw handleDatabaseError(error);
    } finally {
        client.release();
    }
};


/**
 * Update product catalogue information.
 *
 * Inventory quantity is deliberately NOT changed here.
 * Stock must go through the inventory service.
 */
const updateProduct = async (
    productId,
    {
        categoryId,
        name,
        slug,
        description,
        weight,
        isAvailable,
        isFeatured
    }
) => {
    try {
        const existingProduct = await pool.query(
            `
            SELECT id
            FROM products
            WHERE id = $1
            `,
            [productId]
        );

        if (existingProduct.rowCount === 0) {
            const error = new Error('Product not found');
            error.statusCode = 404;
            throw error;
        }

        if (categoryId !== undefined) {
            const categoryResult = await pool.query(
                `
                SELECT id
                FROM categories
                WHERE id = $1
                  AND is_active = TRUE
                `,
                [categoryId]
            );

            if (categoryResult.rowCount === 0) {
                const error = new Error(
                    'Active product category not found'
                );
                error.statusCode = 404;
                throw error;
            }
        }

        const result = await pool.query(
            `
            UPDATE products
            SET
                category_id = COALESCE($1, category_id),
                name = COALESCE($2, name),
                slug = COALESCE($3, slug),
                description = COALESCE($4, description),
                weight = COALESCE($5, weight),
                is_available = COALESCE($6, is_available),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $7
            RETURNING *
            `,
            [
                categoryId ?? null,
                name !== undefined ? name.trim() : null,
                slug !== undefined
                    ? slug.trim().toLowerCase()
                    : null,
                description !== undefined
                    ? description
                    : null,
                weight ?? null,
                isAvailable ?? null,
                productId
            ]
        );

        return result.rows[0];

    } catch (error) {
        throw handleDatabaseError(error);
    }
};


/**
 * Archive a product.
 *
 * We deliberately do NOT physically delete products because
 * historical orders, reviews, inventory movements and other
 * records may reference them.
 *
 * We also disable all variants belonging to the product.
 */
const archiveProduct = async (productId) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const productResult = await client.query(
            `
            UPDATE products
            SET
                is_available = FALSE,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
            `,
            [productId]
        );

        if (productResult.rowCount === 0) {
            const error = new Error('Product not found');
            error.statusCode = 404;
            throw error;
        }

        await client.query(
            `
            UPDATE product_variants
            SET
                is_available = FALSE,
                updated_at = CURRENT_TIMESTAMP
            WHERE product_id = $1
            `,
            [productId]
        );

        await client.query('COMMIT');

        return productResult.rows[0];

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};


/*
|--------------------------------------------------------------------------
| Admin Product Details
|--------------------------------------------------------------------------
*/

/**
 * Get a product for administration.
 *
 * Unlike the customer endpoint, this includes inactive products
 * and all variants.
 */
const getAdminProductById = async (productId) => {
    const productResult = await pool.query(
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
            p.updated_at,

            c.id AS category_id,
            c.name AS category_name,
            c.slug AS category_slug

        FROM products p

        INNER JOIN categories c
            ON p.category_id = c.id

        WHERE p.id = $1
        `,
        [productId]
    );

    if (productResult.rowCount === 0) {
        const error = new Error('Product not found');
        error.statusCode = 404;
        throw error;
    }

    const variantsResult = await pool.query(
        `
        SELECT
            pv.id,
            pv.product_id,
            pv.unit_id,
            pu.name AS unit_name,
            pu.abbreviation,
            pv.sku,
            pv.price,
            pv.stock_quantity,
            pv.is_available,
            pv.options,
            pv.created_at,
            pv.updated_at

        FROM product_variants pv

        INNER JOIN product_units pu
            ON pu.id = pv.unit_id

        WHERE pv.product_id = $1

        ORDER BY pv.id ASC
        `,
        [productId]
    );

    return {
        ...productResult.rows[0],
        variants: variantsResult.rows
    };
};


/*
|--------------------------------------------------------------------------
| Exports
|--------------------------------------------------------------------------
*/

module.exports = {
    getAllProducts,
    getProductById,

    createProduct,
    updateProduct,
    archiveProduct,
    getAdminProductById
};