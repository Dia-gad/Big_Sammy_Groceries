const pool = require('../config/database');


// ============================================================
// CREATE REVIEW
// ============================================================

const createReview = async ({
    userId,
    productId,
    orderItemId,
    rating,
    review
}) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // ----------------------------------------------------
        // 1. Verify the order item exists and belongs to user
        // ----------------------------------------------------

        const orderItemResult = await client.query(
            `
            SELECT
                oi.id,
                oi.product_id,
                oi.order_id,
                o.user_id,
                o.status,
                o.payment_status
            FROM order_items oi
            INNER JOIN orders o
                ON o.id = oi.order_id
            WHERE oi.id = $1
            AND oi.product_id = $2
            AND o.user_id = $3
            `,
            [orderItemId, productId, userId]
        );

        if (orderItemResult.rowCount === 0) {
            const error = new Error(
                'You cannot review this product because the order item does not belong to you'
            );

            error.statusCode = 403;
            throw error;
        }

        const orderItem = orderItemResult.rows[0];

        // ----------------------------------------------------
        // 2. Verify order was completed/delivered
        // ----------------------------------------------------

        if (orderItem.status !== 'delivered') {
            const error = new Error(
                'You can only review products from delivered orders'
            );

            error.statusCode = 400;
            throw error;
        }

        // ----------------------------------------------------
        // 3. Verify payment was successful
        // ----------------------------------------------------

        if (orderItem.payment_status !== 'paid') {
            const error = new Error(
                'You can only review products from paid orders'
            );

            error.statusCode = 400;
            throw error;
        }

        // ----------------------------------------------------
        // 4. Prevent duplicate review
        // ----------------------------------------------------

        const existingReview = await client.query(
            `
            SELECT id
            FROM product_reviews
            WHERE user_id = $1
            AND order_item_id = $2
            `,
            [userId, orderItemId]
        );

        if (existingReview.rowCount > 0) {
            const error = new Error(
                'You have already reviewed this purchased item'
            );

            error.statusCode = 409;
            throw error;
        }

        // ----------------------------------------------------
        // 5. Create review
        // ----------------------------------------------------

        const reviewResult = await client.query(
            `
            INSERT INTO product_reviews (
                user_id,
                product_id,
                order_item_id,
                rating,
                review
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING
                id,
                user_id,
                product_id,
                order_item_id,
                rating,
                review,
                is_approved,
                created_at,
                updated_at
            `,
            [
                userId,
                productId,
                orderItemId,
                rating,
                review || null
            ]
        );

        await client.query('COMMIT');

        return reviewResult.rows[0];

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};


// ============================================================
// GET PRODUCT REVIEWS
// ============================================================

const getProductReviews = async (productId) => {

    const productResult = await pool.query(
        `
        SELECT id
        FROM products
        WHERE id = $1
        `,
        [productId]
    );

    if (productResult.rowCount === 0) {
        const error = new Error('Product not found');
        error.statusCode = 404;
        throw error;
    }

    const result = await pool.query(
        `
        SELECT
            r.id,
            r.product_id,
            r.rating,
            r.review,
            r.created_at,
            r.updated_at,

            u.id AS user_id,
            u.first_name,
            u.last_name

        FROM product_reviews r

        INNER JOIN users u
            ON u.id = r.user_id

        WHERE r.product_id = $1
        AND r.is_approved = TRUE

        ORDER BY r.created_at DESC
        `,
        [productId]
    );

    return result.rows;
};


// ============================================================
// GET CUSTOMER'S REVIEWS
// ============================================================

const getMyReviews = async (userId) => {

    const result = await pool.query(
        `
        SELECT
            r.id,
            r.product_id,
            r.order_item_id,
            r.rating,
            r.review,
            r.is_approved,
            r.created_at,
            r.updated_at,

            p.name AS product_name,
            p.slug AS product_slug

        FROM product_reviews r

        INNER JOIN products p
            ON p.id = r.product_id

        WHERE r.user_id = $1

        ORDER BY r.created_at DESC
        `,
        [userId]
    );

    return result.rows;
};


// ============================================================
// GET SINGLE REVIEW
// ============================================================

const getReviewById = async ({
    reviewId,
    userId
}) => {

    const result = await pool.query(
        `
        SELECT
            r.id,
            r.user_id,
            r.product_id,
            r.order_item_id,
            r.rating,
            r.review,
            r.is_approved,
            r.created_at,
            r.updated_at,

            p.name AS product_name,
            p.slug AS product_slug

        FROM product_reviews r

        INNER JOIN products p
            ON p.id = r.product_id

        WHERE r.id = $1
        AND r.user_id = $2
        `,
        [reviewId, userId]
    );

    if (result.rowCount === 0) {
        const error = new Error('Review not found');
        error.statusCode = 404;
        throw error;
    }

    return result.rows[0];
};


// ============================================================
// UPDATE REVIEW
// ============================================================

const updateReview = async ({
    userId,
    reviewId,
    rating,
    review
}) => {

    const existingReview = await pool.query(
        `
        SELECT id
        FROM product_reviews
        WHERE id = $1
        AND user_id = $2
        `,
        [reviewId, userId]
    );

    if (existingReview.rowCount === 0) {
        const error = new Error('Review not found');
        error.statusCode = 404;
        throw error;
    }

    const result = await pool.query(
        `
        UPDATE product_reviews
        SET
            rating = $1,
            review = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        AND user_id = $4
        RETURNING
            id,
            user_id,
            product_id,
            order_item_id,
            rating,
            review,
            is_approved,
            created_at,
            updated_at
        `,
        [
            rating,
            review || null,
            reviewId,
            userId
        ]
    );

    return result.rows[0];
};


// ============================================================
// DELETE REVIEW
// ============================================================

const deleteReview = async ({
    userId,
    reviewId
}) => {

    const result = await pool.query(
        `
        DELETE FROM product_reviews
        WHERE id = $1
        AND user_id = $2
        RETURNING
            id,
            product_id,
            order_item_id
        `,
        [reviewId, userId]
    );

    if (result.rowCount === 0) {
        const error = new Error('Review not found');
        error.statusCode = 404;
        throw error;
    }

    return result.rows[0];
};


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    createReview,
    getProductReviews,
    getMyReviews,
    getReviewById,
    updateReview,
    deleteReview
};