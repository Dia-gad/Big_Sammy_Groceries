const pool = require('../config/database');

const addToWishlist = async (userId, productId) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Check whether the product exists
        const productResult = await client.query(
            `SELECT id, name, price, stock_quantity, is_available
             FROM products
             WHERE id = $1`,
            [productId]
        );

        if (productResult.rows.length === 0) {
            const error = new Error('Product not found');
            error.statusCode = 404;
            throw error;
        }

        const product = productResult.rows[0];

        // Get the user's wishlist
        let wishlistResult = await client.query(
            `SELECT id
             FROM wishlists
             WHERE user_id = $1`,
            [userId]
        );

        let wishlistId;

        // Create wishlist if the customer doesn't have one
        if (wishlistResult.rows.length === 0) {
            const newWishlist = await client.query(
                `INSERT INTO wishlists (user_id)
                 VALUES ($1)
                 RETURNING id`,
                [userId]
            );

            wishlistId = newWishlist.rows[0].id;
        } else {
            wishlistId = wishlistResult.rows[0].id;
        }

        // Check whether product is already in wishlist
        const existingItem = await client.query(
            `SELECT id
             FROM wishlist_items
             WHERE wishlist_id = $1
             AND product_id = $2`,
            [wishlistId, productId]
        );

        if (existingItem.rows.length > 0) {
            const error = new Error('Product is already in your wishlist');
            error.statusCode = 409;
            throw error;
        }

        // Add product to wishlist
        const wishlistItem = await client.query(
            `INSERT INTO wishlist_items
                (wishlist_id, product_id)
             VALUES ($1, $2)
             RETURNING id, wishlist_id, product_id, created_at`,
            [wishlistId, productId]
        );

        await client.query('COMMIT');

        return {
            wishlist_item: wishlistItem.rows[0],
            product
        };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};


const getMyWishlist = async (userId) => {

    const wishlistResult = await pool.query(
        `SELECT id
         FROM wishlists
         WHERE user_id = $1`,
        [userId]
    );

    // Customer has never created a wishlist
    if (wishlistResult.rows.length === 0) {
        return {
            wishlist_id: null,
            items: []
        };
    }

    const wishlistId = wishlistResult.rows[0].id;

    const result = await pool.query(
        `SELECT
            wi.id AS wishlist_item_id,
            p.id AS product_id,
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
            c.slug AS category_slug,
            wi.created_at AS added_at
         FROM wishlist_items wi
         INNER JOIN products p
             ON wi.product_id = p.id
         INNER JOIN categories c
             ON p.category_id = c.id
         WHERE wi.wishlist_id = $1
         ORDER BY wi.created_at DESC`,
        [wishlistId]
    );

    return {
        wishlist_id: wishlistId,
        items: result.rows
    };
};


const removeFromWishlist = async (userId, wishlistItemId) => {

    const result = await pool.query(
        `DELETE FROM wishlist_items wi
         USING wishlists w
         WHERE wi.id = $1
         AND wi.wishlist_id = w.id
         AND w.user_id = $2
         RETURNING
            wi.id,
            wi.wishlist_id,
            wi.product_id`,
        [wishlistItemId, userId]
    );

    if (result.rows.length === 0) {
        const error = new Error('Wishlist item not found');
        error.statusCode = 404;
        throw error;
    }

    return result.rows[0];
};


module.exports = {
    addToWishlist,
    getMyWishlist,
    removeFromWishlist
};