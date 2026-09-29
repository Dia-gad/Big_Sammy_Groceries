const pool = require('../config/database');


// Generate a unique order number
const generateOrderNumber = () => {
    const timestamp = Date.now();
    const random = Math.floor(1000 + Math.random() * 9000);

    return `BS-${timestamp}-${random}`;
};


// Create an order from the customer's cart
const createOrder = async (
    userId,
    {
        fulfillment_method,
        address_id,
        notes
    }
) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        if (!['delivery', 'pickup'].includes(fulfillment_method)) {
            const error = new Error(
                'Fulfillment method must be delivery or pickup'
            );

            error.statusCode = 400;
            throw error;
        }

        const cartResult = await client.query(
            `SELECT id
             FROM carts
             WHERE user_id = $1`,
            [userId]
        );

        if (cartResult.rows.length === 0) {
            const error = new Error('Your cart is empty');
            error.statusCode = 400;
            throw error;
        }

        const cartId = cartResult.rows[0].id;

        const cartItemsResult = await client.query(
            `SELECT
                ci.id AS cart_item_id,
                ci.product_id,
                ci.quantity,
                p.name,
                p.price,
                p.stock_quantity,
                p.is_available
             FROM cart_items ci
             INNER JOIN products p
                 ON ci.product_id = p.id
             WHERE ci.cart_id = $1
             FOR UPDATE`,
            [cartId]
        );

        const cartItems = cartItemsResult.rows;

        if (cartItems.length === 0) {
            const error = new Error('Your cart is empty');
            error.statusCode = 400;
            throw error;
        }

        for (const item of cartItems) {

            if (!item.is_available) {
                const error = new Error(
                    `${item.name} is currently unavailable`
                );

                error.statusCode = 400;
                throw error;
            }

            if (item.quantity > item.stock_quantity) {
                const error = new Error(
                    `Only ${item.stock_quantity} item(s) of ${item.name} are available`
                );

                error.statusCode = 400;
                throw error;
            }
        }

        const subtotal = cartItems.reduce(
            (sum, item) =>
                sum + Number(item.price) * item.quantity,
            0
        );

        if (fulfillment_method === 'delivery') {

            if (!address_id) {
                const error = new Error(
                    'Delivery address is required for delivery orders'
                );

                error.statusCode = 400;
                throw error;
            }

            const addressResult = await client.query(
                `SELECT id
                 FROM customer_addresses
                 WHERE id = $1
                 AND user_id = $2`,
                [address_id, userId]
            );

            if (addressResult.rows.length === 0) {
                const error = new Error(
                    'Delivery address not found'
                );

                error.statusCode = 404;
                throw error;
            }
        }

        const minimumDeliveryOrderAmount = 5000;

        if (
            fulfillment_method === 'delivery' &&
            subtotal < minimumDeliveryOrderAmount
        ) {
            const error = new Error(
                `Delivery is available only for orders of ₦${minimumDeliveryOrderAmount.toLocaleString()} or more. Please choose pickup instead.`
            );

            error.statusCode = 400;
            throw error;
        }

        let deliveryFee = 0;

        const totalAmount = subtotal + deliveryFee;

        const orderNumber = generateOrderNumber();

        const orderResult = await client.query(
            `INSERT INTO orders (
                user_id,
                order_number,
                status,
                fulfillment_method,
                address_id,
                delivery_fee,
                subtotal,
                total_amount,
                payment_status,
                notes
            )
            VALUES (
                $1,
                $2,
                'pending',
                $3,
                $4,
                $5,
                $6,
                $7,
                'pending',
                $8
            )
            RETURNING
                id,
                user_id,
                order_number,
                status,
                fulfillment_method,
                address_id,
                delivery_fee,
                subtotal,
                total_amount,
                payment_status,
                notes,
                created_at`,
            [
                userId,
                orderNumber,
                fulfillment_method,
                fulfillment_method === 'delivery'
                    ? address_id
                    : null,
                deliveryFee,
                subtotal,
                totalAmount,
                notes || null
            ]
        );

        const order = orderResult.rows[0];

        for (const item of cartItems) {

            const itemSubtotal =
                Number(item.price) * item.quantity;

            await client.query(
                `INSERT INTO order_items (
                    order_id,
                    product_id,
                    product_name,
                    quantity,
                    unit_price,
                    subtotal
                )
                VALUES ($1,$2,$3,$4,$5,$6)`,
                [
                    order.id,
                    item.product_id,
                    item.name,
                    item.quantity,
                    item.price,
                    itemSubtotal
                ]
            );
        }

        await client.query(
            `DELETE FROM cart_items
             WHERE cart_id = $1`,
            [cartId]
        );

        for (const item of cartItems) {

            await client.query(
                `UPDATE products
                 SET
                    stock_quantity = stock_quantity - $1,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2`,
                [
                    item.quantity,
                    item.product_id
                ]
            );
        }

        await client.query('COMMIT');

        return {
            order,
            items: cartItems.map(item => ({
                product_id: item.product_id,
                product_name: item.name,
                quantity: item.quantity,
                unit_price: item.price,
                subtotal:
                    Number(item.price) * item.quantity
            }))
        };

    } catch (error) {

        await client.query('ROLLBACK');

        throw error;

    } finally {

        client.release();
    }
};


// Get all orders belonging to the customer
const getMyOrders = async (userId) => {

    const result = await pool.query(
        `SELECT
            id,
            order_number,
            status,
            fulfillment_method,
            address_id,
            delivery_fee,
            subtotal,
            total_amount,
            payment_status,
            notes,
            created_at,
            updated_at
         FROM orders
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
    );

    return result.rows;
};


// Get one order belonging to the customer
const getMyOrderById = async (userId, orderId) => {

    const orderResult = await pool.query(
        `SELECT
            o.id,
            o.order_number,
            o.status,
            o.fulfillment_method,
            o.address_id,
            o.delivery_fee,
            o.subtotal,
            o.total_amount,
            o.payment_status,
            o.notes,
            o.created_at,
            o.updated_at,

            a.label AS address_label,
            a.recipient_name,
            a.phone AS address_phone,
            a.address_line,
            a.city,
            a.state,
            a.landmark

         FROM orders o

         LEFT JOIN customer_addresses a
             ON o.address_id = a.id

         WHERE o.id = $1
         AND o.user_id = $2`,
        [orderId, userId]
    );

    if (orderResult.rows.length === 0) {
        const error = new Error('Order not found');
        error.statusCode = 404;
        throw error;
    }

    const order = orderResult.rows[0];

    const itemsResult = await pool.query(
        `SELECT
            id,
            product_id,
            product_name,
            quantity,
            unit_price,
            subtotal,
            created_at
         FROM order_items
         WHERE order_id = $1
         ORDER BY id ASC`,
        [orderId]
    );

    return {
        order,
        items: itemsResult.rows
    };
};

const getOrderStatus = async (userId, orderId) => {
    const result = await pool.query(
        `SELECT
            id,
            order_number,
            status,
            fulfillment_method,
            payment_status,
            created_at,
            updated_at
         FROM orders
         WHERE id = $1
         AND user_id = $2`,
        [orderId, userId]
    );

    if (result.rows.length === 0) {
        const error = new Error('Order not found');
        error.statusCode = 404;
        throw error;
    }

    return result.rows[0];
};

module.exports = {
    createOrder,
    getMyOrders,
    getMyOrderById,
    getOrderStatus
};