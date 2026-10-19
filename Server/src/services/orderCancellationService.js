const pool = require('../config/database');
const { releaseReservations } = require('./inventoryReservationService');

const cancelOrder = async ({ orderId, userId }) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Lock the order so two cancellation requests cannot process it simultaneously
        const orderResult = await client.query(
            `
            SELECT
                id,
                user_id,
                order_number,
                status,
                payment_status,
                fulfillment_method
            FROM orders
            WHERE id = $1
            FOR UPDATE
            `,
            [orderId]
        );

        if (orderResult.rows.length === 0) {
            const error = new Error('Order not found');
            error.statusCode = 404;
            throw error;
        }

        const order = orderResult.rows[0];

        // Customer can only cancel their own order
        if (order.user_id !== userId) {
            const error = new Error('You do not have permission to cancel this order');
            error.statusCode = 403;
            throw error;
        }

        // Already cancelled
        if (order.status === 'cancelled') {
            await client.query('ROLLBACK');

            return {
                order,
                message: 'Order is already cancelled'
            };
        }

        // Paid orders must go through refund workflow
        if (order.payment_status === 'paid') {
            const error = new Error(
                'Paid orders cannot be cancelled through this endpoint. Use the refund workflow.'
            );
            error.statusCode = 409;
            throw error;
        }

        // Only pending orders can be cancelled here
        if (order.status !== 'pending') {
            const error = new Error(
                `Order cannot be cancelled while its status is "${order.status}"`
            );
            error.statusCode = 409;
            throw error;
        }

        // Release active inventory reservations
        await releaseReservations({
            orderId: order.id,
            status: 'released',
            client
        });

        // Cancel the order
        const updateResult = await client.query(
            `
            UPDATE orders
            SET
                status = 'cancelled',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING
                id,
                user_id,
                order_number,
                status,
                payment_status,
                fulfillment_method,
                address_id,
                delivery_fee,
                subtotal,
                total_amount,
                notes,
                created_at,
                updated_at
            `,
            [order.id]
        );

        await client.query('COMMIT');

        return {
            order: updateResult.rows[0],
            message: 'Order cancelled and inventory reservation released'
        };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    cancelOrder
};