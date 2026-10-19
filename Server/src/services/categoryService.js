const pool = require('../config/database');

const getAllCategories = async () => {
    const result = await pool.query(`
        SELECT
            c.id,
            c.name,
            c.slug,
            c.description,
            c.image_url,
            c.is_active,
            c.created_at,
            c.updated_at,
            COUNT(p.id)::INTEGER AS product_count
        FROM categories c
        LEFT JOIN products p
            ON p.category_id = c.id
            AND p.is_available = TRUE
        GROUP BY c.id
        ORDER BY c.name ASC
    `);

    return result.rows;
};

const getCategoryById = async (categoryId) => {
    const result = await pool.query(`
        SELECT
            c.id,
            c.name,
            c.slug,
            c.description,
            c.image_url,
            c.is_active,
            c.created_at,
            c.updated_at,
            COUNT(p.id)::INTEGER AS product_count
        FROM categories c
        LEFT JOIN products p
            ON p.category_id = c.id
            AND p.is_available = TRUE
        WHERE c.id = $1
        GROUP BY c.id
    `, [categoryId]);

    if (result.rowCount === 0) {
        const error = new Error('Category not found');
        error.statusCode = 404;
        throw error;
    }

    return result.rows[0];
};

const createCategory = async ({
    name,
    slug,
    description,
    image_url
}) => {
    const existingCategory = await pool.query(
        `
        SELECT id
        FROM categories
        WHERE name = $1 OR slug = $2
        `,
        [name, slug]
    );

    if (existingCategory.rowCount > 0) {
        const error = new Error('A category with this name or slug already exists');
        error.statusCode = 409;
        throw error;
    }

    const result = await pool.query(
        `
        INSERT INTO categories (
            name,
            slug,
            description,
            image_url
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
            id,
            name,
            slug,
            description,
            image_url,
            is_active,
            created_at,
            updated_at
        `,
        [
            name,
            slug,
            description || null,
            image_url || null
        ]
    );

    return result.rows[0];
};

const updateCategory = async (categoryId, {
    name,
    slug,
    description,
    image_url,
    is_active
}) => {
    const category = await getCategoryById(categoryId);

    const updatedName = name !== undefined ? name : category.name;
    const updatedSlug = slug !== undefined ? slug : category.slug;
    const updatedDescription =
        description !== undefined ? description : category.description;
    const updatedImageUrl =
        image_url !== undefined ? image_url : category.image_url;
    const updatedIsActive =
        is_active !== undefined ? is_active : category.is_active;

    const duplicate = await pool.query(
        `
        SELECT id
        FROM categories
        WHERE (name = $1 OR slug = $2)
          AND id <> $3
        `,
        [updatedName, updatedSlug, categoryId]
    );

    if (duplicate.rowCount > 0) {
        const error = new Error('Another category with this name or slug already exists');
        error.statusCode = 409;
        throw error;
    }

    const result = await pool.query(
        `
        UPDATE categories
        SET
            name = $1,
            slug = $2,
            description = $3,
            image_url = $4,
            is_active = $5,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
        RETURNING
            id,
            name,
            slug,
            description,
            image_url,
            is_active,
            created_at,
            updated_at
        `,
        [
            updatedName,
            updatedSlug,
            updatedDescription,
            updatedImageUrl,
            updatedIsActive,
            categoryId
        ]
    );

    return result.rows[0];
};

const deleteCategory = async (categoryId) => {
    await getCategoryById(categoryId);

    const productCheck = await pool.query(
        `
        SELECT COUNT(*)::INTEGER AS product_count
        FROM products
        WHERE category_id = $1
        `,
        [categoryId]
    );

    const productCount = productCheck.rows[0].product_count;

    if (productCount > 0) {
        const error = new Error(
            'Category cannot be deleted because it contains products. Deactivate it instead.'
        );
        error.statusCode = 409;
        throw error;
    }

    await pool.query(
        `DELETE FROM categories WHERE id = $1`,
        [categoryId]
    );

    return {
        id: Number(categoryId),
        deleted: true
    };
};

module.exports = {
    getAllCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory
};