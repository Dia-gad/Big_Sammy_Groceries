const pool = require('../config/database');


// ---------------------------------------------------------
// Get all orders
// ---------------------------------------------------------

const getAllOrders = async () => {
    const result = await pool.query(
        `SELECT
            o.id,
            o.order_number,
            o.user_id,
            u.first_name,
            u.last_name,
            u.email,
            u.phone,
            o.status,
            o.fulfillment_method,
            o.address_id,
            o.delivery_scheduled_at,
            o.delivery_fee,
            o.subtotal,
            o.total_amount,
            o.payment_status,
            o.notes,
            o.created_at,
            o.updated_at
         FROM orders o
         INNER JOIN users u
            ON o.user_id = u.id
         ORDER BY o.created_at DESC`
    );

    return result.rows;
};


// ---------------------------------------------------------
// Get one order by ID
// ---------------------------------------------------------

const getOrderById = async (orderId) => {
    const orderResult = await pool.query(
        `SELECT
            o.id,
            o.order_number,
            o.user_id,
            u.first_name,
            u.last_name,
            u.email,
            u.phone,
            o.status,
            o.fulfillment_method,
            o.address_id,
            o.delivery_scheduled_at,
            o.delivery_fee,
            o.subtotal,
            o.total_amount,
            o.payment_status,
            o.notes,
            o.created_at,
            o.updated_at
         FROM orders o
         INNER JOIN users u
            ON o.user_id = u.id
         WHERE o.id = $1`,
        [orderId]
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
            variant_id,
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


// ---------------------------------------------------------
// Update order status
// ---------------------------------------------------------

const updateOrderStatus = async (orderId, newStatus) => {

    const orderResult = await pool.query(
        `SELECT
            id,
            order_number,
            status,
            fulfillment_method
         FROM orders
         WHERE id = $1`,
        [orderId]
    );

    if (orderResult.rows.length === 0) {
        const error = new Error('Order not found');
        error.statusCode = 404;
        throw error;
    }

    const order = orderResult.rows[0];

    const deliveryTransitions = {
        pending: ['confirmed', 'cancelled'],
        confirmed: ['processing', 'cancelled'],
        processing: ['ready', 'cancelled'],
        ready: ['out_for_delivery', 'cancelled'],
        out_for_delivery: ['delivered']
    };

    const pickupTransitions = {
        pending: ['confirmed', 'cancelled'],
        confirmed: ['processing', 'cancelled'],
        processing: ['ready', 'cancelled'],
        ready: ['picked_up', 'cancelled']
    };

    const transitions =
        order.fulfillment_method === 'delivery'
            ? deliveryTransitions
            : pickupTransitions;

    const allowedNextStatuses =
        transitions[order.status] || [];

    if (!allowedNextStatuses.includes(newStatus)) {
        const error = new Error(
            `Cannot change order status from ${order.status} to ${newStatus}`
        );

        error.statusCode = 400;

        throw error;
    }

    const updatedResult = await pool.query(
        `UPDATE orders
         SET status = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING
            id,
            order_number,
            status,
            fulfillment_method,
            payment_status,
            updated_at`,
        [newStatus, orderId]
    );

    return updatedResult.rows[0];
};


// ---------------------------------------------------------
// Update delivery scheduled time
//
// Only Admin and Manager routes should call this service.
//
// Business rule:
// New delivery time must be at least 1 hour from the
// current server time.
// ---------------------------------------------------------

const updateDeliveryTime = async (
    orderId,
    deliveryScheduledAt
) => {

    // -----------------------------------------------------
    // 1. Validate requested delivery time
    // -----------------------------------------------------

    if (!deliveryScheduledAt) {
        const error = new Error(
            'Delivery time is required'
        );

        error.statusCode = 400;

        throw error;
    }


    const requestedDeliveryTime =
        new Date(deliveryScheduledAt);


    if (Number.isNaN(requestedDeliveryTime.getTime())) {
        const error = new Error(
            'Delivery time must be a valid date and time'
        );

        error.statusCode = 400;

        throw error;
    }


    // -----------------------------------------------------
    // 2. New delivery time must be at least 1 hour away
    // -----------------------------------------------------

    const minimumDeliveryTime =
        new Date(Date.now() + 60 * 60 * 1000);


    if (requestedDeliveryTime < minimumDeliveryTime) {
        const error = new Error(
            'Delivery time must be at least 1 hour from now'
        );

        error.statusCode = 400;

        throw error;
    }


    // -----------------------------------------------------
    // 3. Get the order
    // -----------------------------------------------------

    const orderResult = await pool.query(
        `SELECT
            id,
            order_number,
            status,
            fulfillment_method,
            delivery_scheduled_at,
            payment_status
         FROM orders
         WHERE id = $1`,
        [orderId]
    );


    if (orderResult.rows.length === 0) {
        const error = new Error(
            'Order not found'
        );

        error.statusCode = 404;

        throw error;
    }


    const order = orderResult.rows[0];


    // -----------------------------------------------------
    // 4. Delivery time only applies to delivery orders
    // -----------------------------------------------------

    if (order.fulfillment_method !== 'delivery') {
        const error = new Error(
            'Delivery time can only be changed for delivery orders'
        );

        error.statusCode = 400;

        throw error;
    }


    // -----------------------------------------------------
    // 5. Do not change completed/cancelled orders
    // -----------------------------------------------------

    const lockedStatuses = [
        'delivered',
        'cancelled',
        'picked_up'
    ];


    if (lockedStatuses.includes(order.status)) {
        const error = new Error(
            `Delivery time cannot be changed when order status is ${order.status}`
        );

        error.statusCode = 400;

        throw error;
    }


    // -----------------------------------------------------
    // 6. Update delivery time
    // -----------------------------------------------------

    const updatedResult = await pool.query(
        `UPDATE orders
         SET delivery_scheduled_at = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING
            id,
            order_number,
            status,
            fulfillment_method,
            delivery_scheduled_at,
            payment_status,
            updated_at`,
        [
            requestedDeliveryTime,
            orderId
        ]
    );


    return updatedResult.rows[0];
};


// ---------------------------------------------------------
// Exports
// ---------------------------------------------------------

module.exports = {
    getAllOrders,
    getOrderById,
    updateOrderStatus,
    updateDeliveryTime
};