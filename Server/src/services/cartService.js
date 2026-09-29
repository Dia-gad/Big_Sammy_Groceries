const pool = require('../config/database');

const addToCart = async (userId, productId, quantity) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        let cartResult = await client.query(
            `SELECT id
             FROM carts
             WHERE user_id = $1`,
            [userId]
        );

        let cartId;

        if (cartResult.rows.length === 0) {
            const newCart = await client.query(
                `INSERT INTO carts (user_id)
                 VALUES ($1)
                 RETURNING id`,
                [userId]
            );

            cartId = newCart.rows[0].id;
        } else {
            cartId = cartResult.rows[0].id;
        }

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

        if (!product.is_available) {
            const error = new Error('Product is currently unavailable');
            error.statusCode = 400;
            throw error;
        }

        if (quantity > product.stock_quantity) {
            const error = new Error(
                `Only ${product.stock_quantity} item(s) available`
            );
            error.statusCode = 400;
            throw error;
        }

        const existingItem = await client.query(
            `SELECT id, quantity
             FROM cart_items
             WHERE cart_id = $1
             AND product_id = $2`,
            [cartId, productId]
        );

        let cartItem;

        if (existingItem.rows.length > 0) {
            const newQuantity =
                existingItem.rows[0].quantity + quantity;

            if (newQuantity > product.stock_quantity) {
                const error = new Error(
                    `Only ${product.stock_quantity} item(s) available`
                );
                error.statusCode = 400;
                throw error;
            }

            const updatedItem = await client.query(
                `UPDATE cart_items
                 SET quantity = $1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2
                 RETURNING id, cart_id, product_id, quantity`,
                [newQuantity, existingItem.rows[0].id]
            );

            cartItem = updatedItem.rows[0];
        } else {
            const newItem = await client.query(
                `INSERT INTO cart_items (
                    cart_id,
                    product_id,
                    quantity
                 )
                 VALUES ($1, $2, $3)
                 RETURNING id, cart_id, product_id, quantity`,
                [cartId, productId, quantity]
            );

            cartItem = newItem.rows[0];
        }

        await client.query('COMMIT');

        return cartItem;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};


const getMyCart = async (userId) => {
    const cartResult = await pool.query(
        `SELECT id
         FROM carts
         WHERE user_id = $1`,
        [userId]
    );

    if (cartResult.rows.length === 0) {
        return {
            cart_id: null,
            items: [],
            total: 0,
        };
    }

    const cartId = cartResult.rows[0].id;

    const result = await pool.query(
        `
        SELECT
            ci.id AS cart_item_id,
            p.id AS product_id,
            p.name,
            p.slug,
            p.price,
            p.stock_quantity,
            p.is_available,
            ci.quantity,
            (p.price * ci.quantity) AS subtotal
        FROM cart_items ci
        INNER JOIN products p
            ON ci.product_id = p.id
        WHERE ci.cart_id = $1
        ORDER BY ci.created_at ASC
        `,
        [cartId]
    );

    const total = result.rows.reduce(
        (sum, item) => sum + Number(item.subtotal),
        0
    );

    return {
        cart_id: cartId,
        items: result.rows,
        total,
    };
};


const updateCartItem = async (userId, cartItemId, quantity) => {
    const result = await pool.query(
        `
        SELECT
            ci.id,
            ci.quantity AS current_quantity,
            c.user_id,
            p.id AS product_id,
            p.name,
            p.stock_quantity,
            p.is_available
        FROM cart_items ci
        INNER JOIN carts c
            ON ci.cart_id = c.id
        INNER JOIN products p
            ON ci.product_id = p.id
        WHERE ci.id = $1
        AND c.user_id = $2
        `,
        [cartItemId, userId]
    );

    if (result.rows.length === 0) {
        const error = new Error('Cart item not found');
        error.statusCode = 404;
        throw error;
    }

    const item = result.rows[0];

    if (!item.is_available) {
        const error = new Error('Product is currently unavailable');
        error.statusCode = 400;
        throw error;
    }

    if (quantity > item.stock_quantity) {
        const error = new Error(
            `Only ${item.stock_quantity} item(s) available`
        );
        error.statusCode = 400;
        throw error;
    }

    const updatedItem = await pool.query(
        `
        UPDATE cart_items
        SET quantity = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id, cart_id, product_id, quantity
        `,
        [quantity, cartItemId]
    );

    return updatedItem.rows[0];
};

const removeCartItem = async (userId, cartItemId) => {
    const result = await pool.query(
        `
        DELETE FROM cart_items ci
        USING carts c
        WHERE ci.id = $1
        AND ci.cart_id = c.id
        AND c.user_id = $2
        RETURNING ci.id, ci.cart_id, ci.product_id, ci.quantity
        `,
        [cartItemId, userId]
    );

    if (result.rows.length === 0) {
        const error = new Error('Cart item not found');
        error.statusCode = 404;
        throw error;
    }

    return result.rows[0];
};

module.exports = {
    addToCart,
    getMyCart,
    updateCartItem,
    removeCartItem,
};