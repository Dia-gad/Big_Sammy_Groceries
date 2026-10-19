const pool = require('../config/database');
const { recordMovement } = require('./inventoryService');


/**
 * Create an inventory adjustment request.
 *
 * Inventory staff do NOT change stock here.
 * They only submit a request for approval.
 */
const requestAdjustment = async ({
    variantId,
    requestedStock,
    reason,
    requestedBy
}) => {
    if (!variantId) {
        throw new Error('Variant ID is required');
    }

    if (!Number.isInteger(requestedStock) || requestedStock < 0) {
        throw new Error(
            'Requested stock must be a non-negative whole number'
        );
    }

    if (!reason || !reason.trim()) {
        throw new Error(
            'A reason is required for stock adjustment'
        );
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        /*
         * Lock the variant while reading the current stock.
         * This prevents the request from being created against
         * an unstable stock value.
         */
        const variantResult = await client.query(
            `
            SELECT
                pv.id,
                pv.stock_quantity,
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
            [variantId]
        );

        if (variantResult.rows.length === 0) {
            const error = new Error(
                'Product variant not found'
            );
            error.statusCode = 404;
            throw error;
        }

        const variant = variantResult.rows[0];

        if (variant.stock_quantity === requestedStock) {
            throw new Error(
                'Requested stock is the same as the current stock'
            );
        }

        /*
         * Prevent multiple pending adjustment requests
         * for the same variant.
         */
        const pendingResult = await client.query(
            `
            SELECT id
            FROM inventory_adjustment_requests
            WHERE variant_id = $1
              AND status = 'pending'
            LIMIT 1
            `,
            [variantId]
        );

        if (pendingResult.rows.length > 0) {
            const error = new Error(
                'A pending adjustment request already exists for this variant'
            );
            error.statusCode = 409;
            throw error;
        }

        const adjustmentResult = await client.query(
            `
            INSERT INTO inventory_adjustment_requests (
                variant_id,
                requested_by,
                current_stock,
                requested_stock,
                reason
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            `,
            [
                variantId,
                requestedBy,
                variant.stock_quantity,
                requestedStock,
                reason.trim()
            ]
        );

        await client.query('COMMIT');

        return {
            request: adjustmentResult.rows[0],
            variant: {
                id: variant.id,
                productName: variant.product_name,
                unit: variant.unit,
                currentStock: variant.stock_quantity
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
 * Approve an inventory adjustment request.
 *
 * Only an authorized manager/admin should call this.
 *
 * Stock is changed only after approval.
 */
const approveAdjustment = async ({
    requestId,
    reviewedBy,
    reviewNote = null
}) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        /*
         * Lock the adjustment request.
         */
        const requestResult = await client.query(
            `
            SELECT
                iar.*,
                pv.stock_quantity,
                pv.product_id
            FROM inventory_adjustment_requests iar
            JOIN product_variants pv
                ON pv.id = iar.variant_id
            WHERE iar.id = $1
            FOR UPDATE
            `,
            [requestId]
        );

        if (requestResult.rows.length === 0) {
            const error = new Error(
                'Adjustment request not found'
            );
            error.statusCode = 404;
            throw error;
        }

        const request = requestResult.rows[0];

        if (request.status !== 'pending') {
            const error = new Error(
                `Adjustment request has already been ${request.status}`
            );
            error.statusCode = 409;
            throw error;
        }

        /*
         * Lock the current variant row.
         */
        const variantResult = await client.query(
            `
            SELECT
                id,
                product_id,
                stock_quantity
            FROM product_variants
            WHERE id = $1
            FOR UPDATE
            `,
            [request.variant_id]
        );

        if (variantResult.rows.length === 0) {
            const error = new Error(
                'Product variant no longer exists'
            );
            error.statusCode = 404;
            throw error;
        }

        const variant = variantResult.rows[0];

        /*
         * Critical safety check:
         *
         * The stock must still be exactly what it was
         * when the request was created.
         *
         * If it changed, approval is blocked.
         */
        if (variant.stock_quantity !== request.current_stock) {
            const error = new Error(
                'Stock has changed since this adjustment request was created. Review the request again.'
            );
            error.statusCode = 409;
            throw error;
        }

        /*
         * Calculate the quantity difference.
         */
        const difference = Math.abs(
            request.requested_stock - variant.stock_quantity
        );

        /*
         * We use the existing inventory engine to perform
         * the actual stock change.
         *
         * Adjustment itself is special because recordMovement()
         * intentionally rejects direct adjustment movements.
         *
         * Therefore we update the stock and create the movement
         * inside THIS transaction.
         */
        await client.query(
            `
            UPDATE product_variants
            SET
                stock_quantity = $1,
                is_available = CASE
                    WHEN $1 > 0 THEN TRUE
                    ELSE FALSE
                END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            `,
            [
                request.requested_stock,
                request.variant_id
            ]
        );

        const movementResult = await client.query(
            `
            INSERT INTO inventory_movements (
                product_id,
                variant_id,
                movement_type,
                quantity,
                reference_type,
                reference_id,
                previous_stock,
                new_stock,
                reason,
                created_by
            )
            VALUES (
                $1,
                $2,
                'adjustment',
                $3,
                'adjustment_request',
                $4,
                $5,
                $6,
                $7,
                $8
            )
            RETURNING *
            `,
            [
                request.product_id,
                request.variant_id,
                difference,
                request.id,
                request.current_stock,
                request.requested_stock,
                request.reason,
                reviewedBy
            ]
        );

        /*
         * Mark the request as approved.
         */
        const updateResult = await client.query(
            `
            UPDATE inventory_adjustment_requests
            SET
                status = 'approved',
                reviewed_by = $1,
                review_note = $2,
                reviewed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING *
            `,
            [
                reviewedBy,
                reviewNote,
                requestId
            ]
        );

        await client.query('COMMIT');

        return {
            request: updateResult.rows[0],
            movement: movementResult.rows[0],
            stock: {
                variantId: request.variant_id,
                previousStock: request.current_stock,
                newStock: request.requested_stock,
                quantityChanged: difference
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
 * Reject an inventory adjustment request.
 *
 * No stock is changed.
 */
const rejectAdjustment = async ({
    requestId,
    reviewedBy,
    reviewNote
}) => {
    if (!reviewNote || !reviewNote.trim()) {
        throw new Error(
            'A review note is required when rejecting an adjustment'
        );
    }

    const result = await pool.query(
        `
        UPDATE inventory_adjustment_requests
        SET
            status = 'rejected',
            reviewed_by = $1,
            review_note = $2,
            reviewed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
          AND status = 'pending'
        RETURNING *
        `,
        [
            reviewedBy,
            reviewNote.trim(),
            requestId
        ]
    );

    if (result.rows.length === 0) {
        const error = new Error(
            'Pending adjustment request not found'
        );
        error.statusCode = 404;
        throw error;
    }

    return result.rows[0];
};


/**
 * Get a single adjustment request.
 */
const getAdjustmentRequest = async (requestId) => {
    const result = await pool.query(
        `
        SELECT
            iar.*,
            p.name AS product_name,
            pv.sku,
            pu.name AS unit
        FROM inventory_adjustment_requests iar
        JOIN product_variants pv
            ON pv.id = iar.variant_id
        JOIN products p
            ON p.id = pv.product_id
        JOIN product_units pu
            ON pu.id = pv.unit_id
        WHERE iar.id = $1
        `,
        [requestId]
    );

    if (result.rows.length === 0) {
        const error = new Error(
            'Adjustment request not found'
        );
        error.statusCode = 404;
        throw error;
    }

    return result.rows[0];
};


/**
 * Get adjustment requests.
 */
const getAdjustmentRequests = async ({
    status = null
} = {}) => {
    const result = await pool.query(
        `
        SELECT
            iar.*,
            p.name AS product_name,
            pv.sku,
            pu.name AS unit
        FROM inventory_adjustment_requests iar
        JOIN product_variants pv
            ON pv.id = iar.variant_id
        JOIN products p
            ON p.id = pv.product_id
        JOIN product_units pu
            ON pu.id = pv.unit_id
        WHERE ($1::VARCHAR IS NULL OR iar.status = $1)
        ORDER BY iar.created_at DESC
        `,
        [status]
    );

    return result.rows;
};


module.exports = {
    requestAdjustment,
    approveAdjustment,
    rejectAdjustment,
    getAdjustmentRequest,
    getAdjustmentRequests
};