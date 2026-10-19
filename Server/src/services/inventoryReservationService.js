const pool = require('../config/database');

/**
 * Reserve inventory for an order.
 *
 * The reservation does NOT create a sale.
 * It temporarily holds available stock while payment is pending.
 */
const reserveStock = async ({
    orderId,
    items,
    expiresAt,
    client = pool
}) => {
    if (!orderId) {
        throw new Error('Order ID is required');
    }

    if (!Array.isArray(items) || items.length === 0) {
        throw new Error('Reservation items are required');
    }

    const reservations = [];

    for (const item of items) {
        if (!item.variantId) {
            throw new Error('Variant ID is required');
        }

        if (!item.quantity || item.quantity <= 0) {
            throw new Error('Reservation quantity must be greater than zero');
        }

        // Lock the variant while checking stock.
        const variantResult = await client.query(
            `
            SELECT
                pv.id,
                pv.product_id,
                pv.stock_quantity,
                pv.is_available,
                p.name AS product_name,
                pu.name AS unit
            FROM product_variants pv
            JOIN products p
                ON p.id = pv.product_id
            JOIN product_units pu
                ON pu.id = pv.unit_id
            WHERE pv.id = $1
            FOR UPDATE
            `,
            [item.variantId]
        );

        if (variantResult.rows.length === 0) {
            const error = new Error('Product variant not found');
            error.statusCode = 404;
            throw error;
        }

        const variant = variantResult.rows[0];

        if (!variant.is_available) {
            const error = new Error(
                `${variant.product_name} (${variant.unit}) is unavailable`
            );
            error.statusCode = 400;
            throw error;
        }

        /*
         * Count currently active reservations.
         *
         * Only pending reservations that have not expired
         * are considered unavailable stock.
         */
        const reservationResult = await client.query(
            `
            SELECT COALESCE(SUM(quantity), 0) AS reserved_quantity
            FROM inventory_reservations
            WHERE variant_id = $1
              AND status = 'pending'
              AND expires_at > CURRENT_TIMESTAMP
            `,
            [item.variantId]
        );

        const reservedQuantity =
            Number(reservationResult.rows[0].reserved_quantity);

        const availableQuantity =
            variant.stock_quantity - reservedQuantity;

        if (item.quantity > availableQuantity) {
            const error = new Error(
                `Only ${availableQuantity} ${variant.unit}(s) of ${variant.product_name} are available`
            );

            error.statusCode = 400;
            throw error;
        }

        const reservationResultInsert = await client.query(
            `
            INSERT INTO inventory_reservations (
                variant_id,
                order_id,
                quantity,
                status,
                expires_at
            )
            VALUES (
                $1,
                $2,
                $3,
                'pending',
                $4
            )
            RETURNING *
            `,
            [
                item.variantId,
                orderId,
                item.quantity,
                expiresAt
            ]
        );

        reservations.push(reservationResultInsert.rows[0]);
    }

    return reservations;
};


/**
 * Convert pending reservations into completed sales.
 *
 * This should only happen after successful payment verification.
 */
const convertReservationsToSale = async ({
    orderId,
    userId,
    client = pool
}) => {
    const reservationResult = await client.query(
        `
        SELECT
            ir.id,
            ir.variant_id,
            ir.quantity,
            ir.status,
            ir.expires_at
        FROM inventory_reservations ir
        WHERE ir.order_id = $1
          AND ir.status = 'pending'
        FOR UPDATE
        `,
        [orderId]
    );

    if (reservationResult.rows.length === 0) {
        const error = new Error(
            'No pending inventory reservations found for this order'
        );

        error.statusCode = 404;
        throw error;
    }

    const convertedReservations = [];

    for (const reservation of reservationResult.rows) {
        if (new Date(reservation.expires_at) <= new Date()) {
            const error = new Error(
                'Inventory reservation has expired'
            );

            error.statusCode = 409;
            throw error;
        }

        await client.query(
            `
            UPDATE inventory_reservations
            SET
                status = 'converted',
                converted_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            `,
            [reservation.id]
        );

        convertedReservations.push(reservation);

        /*
         * The actual SALE movement should be recorded
         * separately through inventoryService.recordMovement().
         */
    }

    return convertedReservations;
};


/**
 * Release pending reservations.
 *
 * Used when payment fails, an order is cancelled,
 * or a payment window expires.
 */
const releaseReservations = async ({
    orderId,
    status = 'released',
    client = pool
}) => {
    if (!['released', 'expired'].includes(status)) {
        throw new Error('Invalid reservation release status');
    }

    const result = await client.query(
        `
        UPDATE inventory_reservations
        SET
            status = $1,
            released_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE order_id = $2
          AND status = 'pending'
        RETURNING *
        `,
        [status, orderId]
    );

    return result.rows;
};


/**
 * Get reservations for an order.
 */
const getOrderReservations = async (orderId) => {
    const result = await pool.query(
        `
        SELECT
            ir.*,
            p.name AS product_name,
            pu.name AS unit,
            pv.sku
        FROM inventory_reservations ir
        JOIN product_variants pv
            ON pv.id = ir.variant_id
        JOIN products p
            ON p.id = pv.product_id
        JOIN product_units pu
            ON pu.id = pv.unit_id
        WHERE ir.order_id = $1
        ORDER BY ir.id ASC
        `,
        [orderId]
    );

    return result.rows;
};


module.exports = {
    reserveStock,
    convertReservationsToSale,
    releaseReservations,
    getOrderReservations
};