const pool = require('../config/database');


// =========================================================
// GET RIDER DELIVERIES
// =========================================================

const getMyDeliveries = async (riderId) => {
    const result = await pool.query(
        `
        SELECT
            da.id,
            da.order_id,
            da.rider_id,
            da.status,
            da.assigned_at,
            da.picked_up_at,
            da.out_for_delivery_at,
            da.delivered_at,
            da.delivery_note,
            da.failure_reason,
            da.created_at,
            da.updated_at,

            o.order_number,
            o.status AS order_status,
            o.total_amount,
            o.fulfillment_method,

            ca.id AS address_id,
            ca.recipient_name,
            ca.phone AS recipient_phone,
            ca.address_line,
            ca.city,
            ca.state,
            ca.landmark

        FROM delivery_assignments da

        INNER JOIN orders o
            ON da.order_id = o.id

        LEFT JOIN customer_addresses ca
            ON o.address_id = ca.id

        WHERE da.rider_id = $1

        ORDER BY
            CASE da.status
                WHEN 'assigned' THEN 1
                WHEN 'picked_up' THEN 2
                WHEN 'out_for_delivery' THEN 3
                WHEN 'failed' THEN 4
                WHEN 'delivered' THEN 5
                ELSE 6
            END,
            da.assigned_at DESC
        `,
        [riderId]
    );

    return result.rows;
};


// =========================================================
// GET SINGLE RIDER DELIVERY
// =========================================================

const getMyDeliveryById = async ({
    riderId,
    assignmentId
}) => {

    const result = await pool.query(
        `
        SELECT
            da.id,
            da.order_id,
            da.rider_id,
            da.status,
            da.assigned_at,
            da.picked_up_at,
            da.out_for_delivery_at,
            da.delivered_at,
            da.delivery_note,
            da.failure_reason,
            da.created_at,
            da.updated_at,

            o.order_number,
            o.status AS order_status,
            o.payment_status,
            o.subtotal,
            o.delivery_fee,
            o.total_amount,
            o.fulfillment_method,

            ca.id AS address_id,
            ca.label AS address_label,
            ca.recipient_name,
            ca.phone AS recipient_phone,
            ca.address_line,
            ca.city,
            ca.state,
            ca.landmark

        FROM delivery_assignments da

        INNER JOIN orders o
            ON da.order_id = o.id

        LEFT JOIN customer_addresses ca
            ON o.address_id = ca.id

        WHERE da.id = $1
          AND da.rider_id = $2
        `,
        [
            assignmentId,
            riderId
        ]
    );

    if (result.rowCount === 0) {
        const error = new Error(
            'Delivery assignment not found'
        );

        error.statusCode = 404;
        throw error;
    }

    return result.rows[0];
};


// =========================================================
// PICK UP DELIVERY
// assigned → picked_up
// =========================================================

const pickupDelivery = async ({
    riderId,
    assignmentId,
    deliveryNote = null
}) => {

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const result = await client.query(
            `
            SELECT
                da.id,
                da.order_id,
                da.rider_id,
                da.status,
                o.status AS order_status,
                o.fulfillment_method
            FROM delivery_assignments da

            INNER JOIN orders o
                ON da.order_id = o.id

            WHERE da.id = $1
              AND da.rider_id = $2

            FOR UPDATE
            `,
            [
                assignmentId,
                riderId
            ]
        );

        if (result.rowCount === 0) {
            const error = new Error(
                'Delivery assignment not found'
            );

            error.statusCode = 404;
            throw error;
        }

        const delivery = result.rows[0];

        if (
            delivery.fulfillment_method !==
            'delivery'
        ) {
            const error = new Error(
                'This order is not a delivery order'
            );

            error.statusCode = 400;
            throw error;
        }

        if (delivery.status !== 'assigned') {
            const error = new Error(
                `Delivery cannot be picked up from status "${delivery.status}"`
            );

            error.statusCode = 409;
            throw error;
        }

        const updateResult = await client.query(
            `
            UPDATE delivery_assignments

            SET
                status = 'picked_up',
                picked_up_at = CURRENT_TIMESTAMP,
                delivery_note = COALESCE(
                    $1,
                    delivery_note
                ),
                updated_at = CURRENT_TIMESTAMP

            WHERE id = $2

            RETURNING
                id,
                order_id,
                rider_id,
                status,
                assigned_at,
                picked_up_at,
                out_for_delivery_at,
                delivered_at,
                delivery_note,
                failure_reason,
                updated_at
            `,
            [
                deliveryNote,
                assignmentId
            ]
        );

        // Keep order status synchronized.
        await client.query(
            `
            UPDATE orders

            SET
                status = 'out_for_delivery',
                updated_at = CURRENT_TIMESTAMP

            WHERE id = $1
              AND status IN (
                  'processing',
                  'ready'
              )
            `,
            [delivery.order_id]
        );

        await client.query('COMMIT');

        return updateResult.rows[0];

    } catch (error) {

        await client.query('ROLLBACK');

        throw error;

    } finally {
        client.release();
    }
};


// =========================================================
// START DELIVERY
// picked_up → out_for_delivery
// =========================================================

const startDelivery = async ({
    riderId,
    assignmentId,
    deliveryNote = null
}) => {

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const result = await client.query(
            `
            SELECT
                da.id,
                da.order_id,
                da.rider_id,
                da.status,
                o.status AS order_status,
                o.fulfillment_method
            FROM delivery_assignments da

            INNER JOIN orders o
                ON da.order_id = o.id

            WHERE da.id = $1
              AND da.rider_id = $2

            FOR UPDATE
            `,
            [
                assignmentId,
                riderId
            ]
        );

        if (result.rowCount === 0) {
            const error = new Error(
                'Delivery assignment not found'
            );

            error.statusCode = 404;
            throw error;
        }

        const delivery = result.rows[0];

        if (
            delivery.fulfillment_method !==
            'delivery'
        ) {
            const error = new Error(
                'This order is not a delivery order'
            );

            error.statusCode = 400;
            throw error;
        }

        if (
            delivery.status !==
            'picked_up'
        ) {
            const error = new Error(
                `Delivery cannot be started from status "${delivery.status}"`
            );

            error.statusCode = 409;
            throw error;
        }

        const updateResult = await client.query(
            `
            UPDATE delivery_assignments

            SET
                status = 'out_for_delivery',
                out_for_delivery_at =
                    CURRENT_TIMESTAMP,
                delivery_note = COALESCE(
                    $1,
                    delivery_note
                ),
                updated_at =
                    CURRENT_TIMESTAMP

            WHERE id = $2

            RETURNING
                id,
                order_id,
                rider_id,
                status,
                assigned_at,
                picked_up_at,
                out_for_delivery_at,
                delivered_at,
                delivery_note,
                failure_reason,
                updated_at
            `,
            [
                deliveryNote,
                assignmentId
            ]
        );

        await client.query(
            `
            UPDATE orders

            SET
                status = 'out_for_delivery',
                updated_at = CURRENT_TIMESTAMP

            WHERE id = $1
            `,
            [delivery.order_id]
        );

        await client.query('COMMIT');

        return updateResult.rows[0];

    } catch (error) {

        await client.query('ROLLBACK');

        throw error;

    } finally {
        client.release();
    }
};


// =========================================================
// COMPLETE DELIVERY
// out_for_delivery → delivered
// =========================================================

const completeDelivery = async ({
    riderId,
    assignmentId,
    deliveryNote = null
}) => {

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const result = await client.query(
            `
            SELECT
                da.id,
                da.order_id,
                da.rider_id,
                da.status,
                o.status AS order_status,
                o.fulfillment_method,
                o.payment_status
            FROM delivery_assignments da

            INNER JOIN orders o
                ON da.order_id = o.id

            WHERE da.id = $1
              AND da.rider_id = $2

            FOR UPDATE
            `,
            [
                assignmentId,
                riderId
            ]
        );

        if (result.rowCount === 0) {
            const error = new Error(
                'Delivery assignment not found'
            );

            error.statusCode = 404;
            throw error;
        }

        const delivery = result.rows[0];

        if (
            delivery.fulfillment_method !==
            'delivery'
        ) {
            const error = new Error(
                'This order is not a delivery order'
            );

            error.statusCode = 400;
            throw error;
        }

        if (
            delivery.status !==
            'out_for_delivery'
        ) {
            const error = new Error(
                `Delivery cannot be completed from status "${delivery.status}"`
            );

            error.statusCode = 409;
            throw error;
        }

        if (
            delivery.payment_status !==
            'paid'
        ) {
            const error = new Error(
                'Cannot complete delivery for an unpaid order'
            );

            error.statusCode = 409;
            throw error;
        }

        const updateResult = await client.query(
            `
            UPDATE delivery_assignments

            SET
                status = 'delivered',
                delivered_at =
                    CURRENT_TIMESTAMP,
                delivery_note = COALESCE(
                    $1,
                    delivery_note
                ),
                updated_at =
                    CURRENT_TIMESTAMP

            WHERE id = $2

            RETURNING
                id,
                order_id,
                rider_id,
                status,
                assigned_at,
                picked_up_at,
                out_for_delivery_at,
                delivered_at,
                delivery_note,
                failure_reason,
                updated_at
            `,
            [
                deliveryNote,
                assignmentId
            ]
        );

        await client.query(
            `
            UPDATE orders

            SET
                status = 'delivered',
                updated_at = CURRENT_TIMESTAMP

            WHERE id = $1
            `,
            [delivery.order_id]
        );

        await client.query('COMMIT');

        return updateResult.rows[0];

    } catch (error) {

        await client.query('ROLLBACK');

        throw error;

    } finally {
        client.release();
    }
};


// =========================================================
// REPORT DELIVERY FAILURE
//
// out_for_delivery → failed
// =========================================================

const failDelivery = async ({
    riderId,
    assignmentId,
    failureReason
}) => {

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const result = await client.query(
            `
            SELECT
                da.id,
                da.order_id,
                da.rider_id,
                da.status,
                o.status AS order_status,
                o.fulfillment_method
            FROM delivery_assignments da

            INNER JOIN orders o
                ON da.order_id = o.id

            WHERE da.id = $1
              AND da.rider_id = $2

            FOR UPDATE
            `,
            [
                assignmentId,
                riderId
            ]
        );

        if (result.rowCount === 0) {
            const error = new Error(
                'Delivery assignment not found'
            );

            error.statusCode = 404;
            throw error;
        }

        const delivery = result.rows[0];

        if (
            delivery.fulfillment_method !==
            'delivery'
        ) {
            const error = new Error(
                'This order is not a delivery order'
            );

            error.statusCode = 400;
            throw error;
        }

        if (
            delivery.status !==
            'out_for_delivery'
        ) {
            const error = new Error(
                `Delivery cannot be failed from status "${delivery.status}"`
            );

            error.statusCode = 409;
            throw error;
        }

        if (
            !failureReason ||
            !failureReason.trim()
        ) {
            const error = new Error(
                'Failure reason is required'
            );

            error.statusCode = 400;
            throw error;
        }

        const updateResult = await client.query(
            `
            UPDATE delivery_assignments

            SET
                status = 'failed',
                failure_reason = $1,
                updated_at =
                    CURRENT_TIMESTAMP

            WHERE id = $2

            RETURNING
                id,
                order_id,
                rider_id,
                status,
                assigned_at,
                picked_up_at,
                out_for_delivery_at,
                delivered_at,
                delivery_note,
                failure_reason,
                updated_at
            `,
            [
                failureReason.trim(),
                assignmentId
            ]
        );

        await client.query(
            `
            UPDATE orders

            SET
                status = 'ready',
                updated_at =
                    CURRENT_TIMESTAMP

            WHERE id = $1
            `,
            [delivery.order_id]
        );

        await client.query('COMMIT');

        return updateResult.rows[0];

    } catch (error) {

        await client.query('ROLLBACK');

        throw error;

    } finally {
        client.release();
    }
};


module.exports = {
    getMyDeliveries,
    getMyDeliveryById,
    pickupDelivery,
    startDelivery,
    completeDelivery,
    failDelivery
};