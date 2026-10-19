const pool = require('../config/database');

/**
 * Add a product variant to the customer's cart.
 */
const addProductToCart = async ({
    userId,
    variantId,
    quantity
}) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Lock the variant so stock cannot change unexpectedly
        // while we are validating the cart addition.
        const variantResult = await client.query(
            `
            SELECT
                pv.id,
                pv.product_id,
                pv.price,
                pv.stock_quantity,
                pv.is_available,
                p.name AS product_name,
                pu.name AS unit,
                pu.abbreviation,
                pv.options
            FROM product_variants pv
            JOIN products p
                ON p.id = pv.product_id
            JOIN product_units pu
                ON pu.id = pv.unit_id
            WHERE pv.id = $1
            FOR UPDATE
            `,
            [variantId]
        );

        if (variantResult.rows.length === 0) {
            const error = new Error('Product variant not found');
            error.statusCode = 404;
            throw error;
        }

        const variant = variantResult.rows[0];

        if (!variant.is_available) {
            const error = new Error('This product variant is not available');
            error.statusCode = 400;
            throw error;
        }

        if (variant.stock_quantity < quantity) {
            const error = new Error(
                `Only ${variant.stock_quantity} unit(s) available`
            );
            error.statusCode = 400;
            throw error;
        }

        // Find the customer's cart.
        const cartResult = await client.query(
            `
            SELECT id
            FROM carts
            WHERE user_id = $1
            LIMIT 1
            `,
            [userId]
        );

        if (cartResult.rows.length === 0) {
            const error = new Error('Cart not found');
            error.statusCode = 404;
            throw error;
        }

        const cartId = cartResult.rows[0].id;

        // Check whether this variant is already in the cart.
        const existingItemResult = await client.query(
            `
            SELECT id, quantity
            FROM cart_items
            WHERE cart_id = $1
              AND variant_id = $2
            FOR UPDATE
            `,
            [cartId, variantId]
        );

        let cartItem;

        if (existingItemResult.rows.length > 0) {
            const existingItem = existingItemResult.rows[0];
            const newQuantity = existingItem.quantity + quantity;

            if (newQuantity > variant.stock_quantity) {
                const error = new Error(
                    `Only ${variant.stock_quantity} unit(s) available`
                );
                error.statusCode = 400;
                throw error;
            }

            const updateResult = await client.query(
                `
                UPDATE cart_items
                SET
                    quantity = $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING *
                `,
                [newQuantity, existingItem.id]
            );

            cartItem = updateResult.rows[0];
        } else {
            const insertResult = await client.query(
                `
                INSERT INTO cart_items (
                    cart_id,
                    variant_id,
                    quantity
                )
                VALUES ($1, $2, $3)
                RETURNING *
                `,
                [cartId, variantId, quantity]
            );

            cartItem = insertResult.rows[0];
        }

        await client.query(
            `
            UPDATE carts
            SET updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            `,
            [cartId]
        );

        await client.query('COMMIT');

        return {
            ...cartItem,
            product: {
                id: variant.product_id,
                name: variant.product_name,
                variantId: variant.id,
                unit: variant.unit,
                abbreviation: variant.abbreviation,
                price: variant.price,
                stockQuantity: variant.stock_quantity,
                options: variant.options
            }
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};


/**
 * Get the customer's cart with complete variant information.
 */
const getCart = async (userId) => {
    const result = await pool.query(
        `
        SELECT
            ci.id,
            ci.cart_id,
            ci.variant_id,
            ci.quantity,
            ci.created_at,
            ci.updated_at,

            pv.product_id,
            pv.price,
            pv.stock_quantity,
            pv.is_available,
            pv.sku,
            pv.options,

            p.name AS product_name,
            p.slug AS product_slug,

            pu.name AS unit,
            pu.abbreviation AS unit_abbreviation,

            (pv.price * ci.quantity) AS subtotal

        FROM cart_items ci

        JOIN carts c
            ON c.id = ci.cart_id

        JOIN product_variants pv
            ON pv.id = ci.variant_id

        JOIN products p
            ON p.id = pv.product_id

        JOIN product_units pu
            ON pu.id = pv.unit_id

        WHERE c.user_id = $1

        ORDER BY ci.id ASC
        `,
        [userId]
    );

    const items = result.rows;

    const subtotal = items.reduce(
        (total, item) => total + Number(item.subtotal),
        0
    );

    return {
        items,
        itemCount: items.reduce(
            (total, item) => total + item.quantity,
            0
        ),
        subtotal
    };
};


/**
 * Update the quantity of a cart item.
 */
const updateCart = async ({
    userId,
    variantId,
    quantity
}) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const variantResult = await client.query(
            `
            SELECT
                pv.id,
                pv.stock_quantity,
                pv.is_available
            FROM product_variants pv
            WHERE pv.id = $1
            FOR UPDATE
            `,
            [variantId]
        );

        if (variantResult.rows.length === 0) {
            const error = new Error('Product variant not found');
            error.statusCode = 404;
            throw error;
        }

        const variant = variantResult.rows[0];

        if (!variant.is_available) {
            const error = new Error('This product variant is not available');
            error.statusCode = 400;
            throw error;
        }

        if (quantity > variant.stock_quantity) {
            const error = new Error(
                `Only ${variant.stock_quantity} unit(s) available`
            );
            error.statusCode = 400;
            throw error;
        }

        const result = await client.query(
            `
            UPDATE cart_items ci
            SET
                quantity = $1,
                updated_at = CURRENT_TIMESTAMP
            FROM carts c
            WHERE ci.cart_id = c.id
              AND c.user_id = $2
              AND ci.variant_id = $3
            RETURNING ci.*
            `,
            [quantity, userId, variantId]
        );

        if (result.rows.length === 0) {
            const error = new Error('Cart item not found');
            error.statusCode = 404;
            throw error;
        }

        await client.query(
            `
            UPDATE carts
            SET updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $1
            `,
            [userId]
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


/**
 * Remove a product variant from the customer's cart.
 */
const removeFromCart = async ({
    userId,
    variantId
}) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const result = await client.query(
            `
            DELETE FROM cart_items ci
            USING carts c
            WHERE ci.cart_id = c.id
              AND c.user_id = $1
              AND ci.variant_id = $2
            RETURNING ci.*
            `,
            [userId, variantId]
        );

        if (result.rows.length === 0) {
            const error = new Error('Cart item not found');
            error.statusCode = 404;
            throw error;
        }

        await client.query(
            `
            UPDATE carts
            SET updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $1
            `,
            [userId]
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


module.exports = {
    addProductToCart,
    getCart,
    updateCart,
    removeFromCart
};