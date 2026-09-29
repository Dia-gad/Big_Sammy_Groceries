const pool = require('../config/database');

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

    const allowedNextStatuses = transitions[order.status] || [];

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

module.exports = {
    getAllOrders,
    getOrderById,
    updateOrderStatus
};