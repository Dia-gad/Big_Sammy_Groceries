const pool = require('../config/database');

const assignRider = async ({ orderId, riderId, assignedBy }) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Lock the order
        const orderResult = await client.query(
            `
            SELECT
                id,
                status,
                fulfillment_method
            FROM orders
            WHERE id = $1
            FOR UPDATE
            `,
            [orderId]
        );

        if (orderResult.rowCount === 0) {
            const error = new Error('Order not found');
            error.statusCode = 404;
            throw error;
        }

        const order = orderResult.rows[0];

        if (order.fulfillment_method !== 'delivery') {
            const error = new Error(
                'Only delivery orders can be assigned to a rider'
            );
            error.statusCode = 400;
            throw error;
        }

        if (!['confirmed', 'processing', 'ready'].includes(order.status)) {
            const error = new Error(
                `Order cannot be assigned to a rider while its status is "${order.status}"`
            );
            error.statusCode = 400;
            throw error;
        }

        // Verify rider
        const riderResult = await client.query(
            `
            SELECT id, first_name, last_name, email, phone, role
            FROM users
            WHERE id = $1
            `,
            [riderId]
        );

        if (riderResult.rowCount === 0) {
            const error = new Error('Rider not found');
            error.statusCode = 404;
            throw error;
        }

        const rider = riderResult.rows[0];

        if (rider.role !== 'rider') {
            const error = new Error(
                'Selected user is not registered as a rider'
            );
            error.statusCode = 400;
            throw error;
        }

        // Prevent assigning a rider when another active assignment exists
        const existingResult = await client.query(
            `
            SELECT id, rider_id, status
            FROM delivery_assignments
            WHERE order_id = $1
            FOR UPDATE
            `,
            [orderId]
        );

        let delivery;

        if (existingResult.rowCount > 0) {
            const existing = existingResult.rows[0];

            if (
                ['picked_up', 'out_for_delivery', 'delivered'].includes(
                    existing.status
                )
            ) {
                const error = new Error(
                    'This delivery can no longer be reassigned'
                );
                error.statusCode = 400;
                throw error;
            }

            const updateResult = await client.query(
                `
                UPDATE delivery_assignments
                SET
                    rider_id = $1,
                    status = 'assigned',
                    assigned_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING *
                `,
                [riderId, existing.id]
            );

            delivery = updateResult.rows[0];
        } else {
            const insertResult = await client.query(
                `
                INSERT INTO delivery_assignments (
                    order_id,
                    rider_id,
                    status,
                    assigned_at
                )
                VALUES ($1, $2, 'assigned', CURRENT_TIMESTAMP)
                RETURNING *
                `,
                [orderId, riderId]
            );

            delivery = insertResult.rows[0];
        }

        // Move order into processing if it is still confirmed
        if (order.status === 'confirmed') {
            await client.query(
                `
                UPDATE orders
                SET
                    status = 'processing',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                `,
                [orderId]
            );
        }

        await client.query('COMMIT');

        return {
            delivery,
            rider: {
                id: rider.id,
                firstName: rider.first_name,
                lastName: rider.last_name,
                email: rider.email,
                phone: rider.phone
            },
            assignedBy
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    assignRider
};