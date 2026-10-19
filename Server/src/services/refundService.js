const pool = require('../config/database');
const { recordMovement } = require('./inventoryService');

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_API_URL = 'https://api.paystack.co';

/**
 * ============================================================
 * PAYSTACK REQUEST HELPER
 * ============================================================
 */

const paystackRequest = async (endpoint, options = {}) => {
    if (!PAYSTACK_SECRET_KEY) {
        const error = new Error(
            'PAYSTACK_SECRET_KEY is not configured'
        );

        error.statusCode = 500;
        throw error;
    }

    const response = await fetch(
        `${PAYSTACK_API_URL}${endpoint}`,
        {
            ...options,

            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        }
    );

    let data;

    try {
        data = await response.json();
    } catch (parseError) {
        const error = new Error(
            'Invalid response received from Paystack'
        );

        error.statusCode = 502;

        error.gatewayResponse = {
            httpStatus: response.status
        };

        throw error;
    }

    if (!response.ok || !data.status) {
        const error = new Error(
            data.message || 'Paystack request failed'
        );

        error.statusCode = response.status || 502;
        error.gatewayResponse = data;

        throw error;
    }

    return data;
};


/**
 * ============================================================
 * UPDATE ORDER REFUND STATUS
 * ============================================================
 *
 * Determines whether the payment has been partially or fully
 * refunded.
 *
 * Partial refund:
 *     payment_status = paid
 *
 * Full refund:
 *     payment_status = refunded
 *
 * Only processed refunds are counted.
 */
const updateOrderRefundStatus = async (paymentId) => {
    const result = await pool.query(
        `
        SELECT
            p.id AS payment_id,
            p.order_id,
            p.amount AS payment_amount,

            COALESCE(
                SUM(
                    CASE
                        WHEN pr.status = 'processed'
                        THEN pr.amount
                        ELSE 0
                    END
                ),
                0
            ) AS refunded_amount

        FROM payments p

        LEFT JOIN payment_refunds pr
            ON pr.payment_id = p.id

        WHERE p.id = $1

        GROUP BY
            p.id,
            p.order_id,
            p.amount
        `,
        [paymentId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const row = result.rows[0];

    const paymentAmount = Number(row.payment_amount);
    const refundedAmount = Number(row.refunded_amount);

    let paymentStatus = 'paid';

    if (refundedAmount >= paymentAmount) {
        paymentStatus = 'refunded';
    }

    await pool.query(
        `
        UPDATE orders
        SET
            payment_status = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        `,
        [
            paymentStatus,
            row.order_id
        ]
    );

    return {
        orderId: row.order_id,
        paymentAmount,
        refundedAmount,
        paymentStatus
    };
};


/**
 * ============================================================
 * RESTORE INVENTORY FOR A FULLY PROCESSED REFUND
 * ============================================================
 *
 * IMPORTANT:
 *
 * Inventory is restored ONLY when the refund is fully processed.
 *
 * Partial refunds do NOT automatically restore inventory because
 * a partial monetary refund does not necessarily mean products
 * were returned.
 *
 * This function is idempotent:
 *
 * If the same refund is processed more than once by a webhook,
 * synchronization request, or retry, inventory will NOT be
 * restored twice.
 */
const restoreInventoryForRefund = async ({
    refundId,
    client
}) => {
    /**
     * Lock refund record.
     */
    const refundResult = await client.query(
        `
        SELECT
            pr.id,
            pr.payment_id,
            pr.order_id,
            pr.amount,
            pr.status,
            pr.initiated_by,

            p.amount AS payment_amount,
            p.status AS payment_status

        FROM payment_refunds pr

        JOIN payments p
            ON p.id = pr.payment_id

        WHERE pr.id = $1

        FOR UPDATE
        `,
        [refundId]
    );

    if (refundResult.rows.length === 0) {
        const error = new Error(
            'Refund not found'
        );

        error.statusCode = 404;

        throw error;
    }

    const refund = refundResult.rows[0];

    /**
     * Inventory can only be restored after the gateway
     * confirms the refund as processed.
     */
    if (refund.status !== 'processed') {
        return {
            restored: false,
            reason: 'Refund is not processed'
        };
    }

    /**
     * Determine the total amount successfully refunded
     * for this payment.
     */
    const refundTotalResult = await client.query(
        `
        SELECT
            COALESCE(
                SUM(amount),
                0
            ) AS refunded_amount

        FROM payment_refunds

        WHERE payment_id = $1

          AND status = 'processed'
        `,
        [refund.payment_id]
    );

    const refundedAmount = Number(
        refundTotalResult.rows[0].refunded_amount
    );

    const paymentAmount = Number(
        refund.payment_amount
    );

    /**
     * Inventory restoration is only automatic for a FULL
     * refund.
     */
    if (refundedAmount < paymentAmount) {
        return {
            restored: false,
            reason: 'Partial refund; inventory return requires full refund'
        };
    }

    /**
     * Get the order items.
     *
     * variant_id is now the authoritative inventory identifier.
     */
    const orderItemsResult = await client.query(
        `
        SELECT
            oi.id,
            oi.order_id,
            oi.product_id,
            oi.variant_id,
            oi.product_name,
            oi.quantity,
            oi.unit_price,
            oi.subtotal

        FROM order_items oi

        WHERE oi.order_id = $1

        ORDER BY oi.id

        FOR UPDATE
        `,
        [refund.order_id]
    );

    if (orderItemsResult.rows.length === 0) {
        const error = new Error(
            'Cannot restore inventory because the order has no items'
        );

        error.statusCode = 409;

        throw error;
    }

    const returnMovements = [];

    /**
     * Restore every item.
     *
     * Idempotency is based on:
     *
     * reference_type = 'refund'
     * reference_id   = refund.id
     * variant_id     = order item variant
     */
    for (const item of orderItemsResult.rows) {

        if (!item.variant_id) {
            const error = new Error(
                `Order item ${item.id} does not have a variant_id`
            );

            error.statusCode = 409;

            throw error;
        }

        /**
         * Check whether this refund already restored this variant.
         */
        const existingMovementResult = await client.query(
            `
            SELECT
                id,
                variant_id,
                quantity,
                previous_stock,
                new_stock

            FROM inventory_movements

            WHERE reference_type = 'refund'

              AND reference_id = $1

              AND variant_id = $2

              AND movement_type = 'return'

            LIMIT 1
            `,
            [
                refund.id,
                item.variant_id
            ]
        );

        if (existingMovementResult.rows.length > 0) {
            returnMovements.push(
                existingMovementResult.rows[0]
            );

            continue;
        }

        /**
         * Create RETURN movement.
         *
         * inventoryService.recordMovement() handles:
         *
         * - row locking
         * - stock increment
         * - availability
         * - inventory audit trail
         */
        const movement = await recordMovement({
            variantId: item.variant_id,

            movementType: 'return',

            quantity: item.quantity,

            referenceType: 'refund',

            referenceId: refund.id,

            reason: `Inventory returned after full refund for order ${refund.order_id}`,

            createdBy: refund.initiated_by || null,

            client
        });

        returnMovements.push(movement);
    }

    return {
        restored: true,
        refundId: refund.id,
        orderId: refund.order_id,
        refundedAmount,
        paymentAmount,
        movements: returnMovements
    };
};


/**
 * ============================================================
 * FINALIZE PROCESSED REFUND
 * ============================================================
 *
 * This function is the central point for handling a successful
 * refund.
 *
 * It performs:
 *
 * 1. Lock refund
 * 2. Confirm refund is processed
 * 3. Restore inventory when fully refunded
 * 4. Update order payment status
 * 5. Update order status where appropriate
 *
 * Everything happens inside ONE database transaction.
 */
const finalizeProcessedRefund = async (refundId) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        /**
         * Lock refund.
         */
        const refundResult = await client.query(
            `
            SELECT
                pr.id,
                pr.payment_id,
                pr.order_id,
                pr.status,
                pr.amount,

                p.amount AS payment_amount,
                p.user_id,

                o.status AS order_status,
                o.payment_status

            FROM payment_refunds pr

            JOIN payments p
                ON p.id = pr.payment_id

            JOIN orders o
                ON o.id = pr.order_id

            WHERE pr.id = $1

            FOR UPDATE
            `,
            [refundId]
        );

        if (refundResult.rows.length === 0) {
            const error = new Error(
                'Refund not found'
            );

            error.statusCode = 404;

            throw error;
        }

        const refund = refundResult.rows[0];

        /**
         * Nothing to finalize unless gateway says processed.
         */
        if (refund.status !== 'processed') {
            await client.query('COMMIT');

            return {
                refund,
                inventory: {
                    restored: false,
                    reason: 'Refund is not processed'
                }
            };
        }

        /**
         * Restore inventory if this is a full refund.
         *
         * restoreInventoryForRefund() is idempotent.
         */
        const inventory =
            await restoreInventoryForRefund({
                refundId,
                client
            });

        /**
         * Calculate total successfully refunded.
         */
        const totalRefundResult = await client.query(
            `
            SELECT
                COALESCE(
                    SUM(amount),
                    0
                ) AS refunded_amount

            FROM payment_refunds

            WHERE payment_id = $1

              AND status = 'processed'
            `,
            [refund.payment_id]
        );

        const refundedAmount = Number(
            totalRefundResult.rows[0].refunded_amount
        );

        const paymentAmount = Number(
            refund.payment_amount
        );

        const isFullyRefunded =
            refundedAmount >= paymentAmount;

        /**
         * Update payment status.
         */
        const paymentStatus =
            isFullyRefunded
                ? 'refunded'
                : 'paid';

        await client.query(
            `
            UPDATE orders

            SET
                payment_status = $1,
                updated_at = CURRENT_TIMESTAMP

            WHERE id = $2
            `,
            [
                paymentStatus,
                refund.order_id
            ]
        );

        /**
         * A full refund of an order that has not yet been
         * completed can safely move the order to cancelled.
         *
         * Delivered/picked-up orders remain in their fulfillment
         * state because a refund does not erase fulfillment history.
         */
        if (
            isFullyRefunded &&
            [
                'pending',
                'confirmed',
                'processing',
                'ready',
                'out_for_delivery'
            ].includes(refund.order_status)
        ) {
            await client.query(
                `
                UPDATE orders

                SET
                    status = 'cancelled',
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = $1
                `,
                [refund.order_id]
            );
        }

        await client.query('COMMIT');

        return {
            refundId: refund.id,
            paymentId: refund.payment_id,
            orderId: refund.order_id,

            refundedAmount,
            paymentAmount,

            paymentStatus,

            fullyRefunded: isFullyRefunded,

            inventory
        };

    } catch (error) {
        await client.query('ROLLBACK');

        throw error;

    } finally {
        client.release();
    }
};


/**
 * ============================================================
 * CREATE REFUND
 * ============================================================
 *
 * Supports:
 *
 * - Partial refunds
 * - Full refunds
 *
 * If amount is omitted, the remaining refundable amount
 * is refunded.
 */
const createRefund = async ({
    paymentId,
    amount = null,
    customerNote = null,
    merchantNote = null,
    reason = null,
    initiatedBy
}) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        /**
         * Lock payment so two refund requests cannot
         * calculate the refundable balance simultaneously.
         */
        const paymentResult = await client.query(
            `
            SELECT
                p.id,
                p.order_id,
                p.user_id,
                p.reference,
                p.gateway_transaction_id,
                p.amount,
                p.currency,
                p.status,

                o.payment_status,
                o.status AS order_status

            FROM payments p

            JOIN orders o
                ON o.id = p.order_id

            WHERE p.id = $1

            FOR UPDATE
            `,
            [paymentId]
        );

        if (paymentResult.rows.length === 0) {
            const error = new Error(
                'Payment not found'
            );

            error.statusCode = 404;

            throw error;
        }

        const payment = paymentResult.rows[0];

        /**
         * Only successful payments can be refunded.
         */
        if (payment.status !== 'success') {
            const error = new Error(
                'Only successful payments can be refunded'
            );

            error.statusCode = 400;

            throw error;
        }

        /**
         * Calculate already refunded amount.
         *
         * Pending/processing/needs_attention/processed refunds
         * are reserved against the refundable balance.
         *
         * Failed/reversed refunds are not counted.
         */
        const refundTotalResult = await client.query(
            `
            SELECT
                COALESCE(
                    SUM(amount),
                    0
                ) AS total

            FROM payment_refunds

            WHERE payment_id = $1

              AND status IN (
                  'pending',
                  'processing',
                  'needs_attention',
                  'processed'
              )
            `,
            [paymentId]
        );

        const alreadyRefunded = Number(
            refundTotalResult.rows[0].total
        );

        const paymentAmount = Number(
            payment.amount
        );

        const remainingAmount =
            paymentAmount - alreadyRefunded;

        if (remainingAmount <= 0) {
            const error = new Error(
                'There is no refundable amount remaining'
            );

            error.statusCode = 400;

            throw error;
        }

        /**
         * If amount is omitted, refund everything remaining.
         */
        const requestedAmount =
            amount === null
                ? remainingAmount
                : Number(amount);

        if (!Number.isFinite(requestedAmount)) {
            const error = new Error(
                'Refund amount must be a valid number'
            );

            error.statusCode = 400;

            throw error;
        }

        if (requestedAmount <= 0) {
            const error = new Error(
                'Refund amount must be greater than zero'
            );

            error.statusCode = 400;

            throw error;
        }

        if (requestedAmount > remainingAmount) {
            const error = new Error(
                `Refund amount cannot exceed the remaining refundable amount of ${remainingAmount.toFixed(2)}`
            );

            error.statusCode = 400;

            throw error;
        }

        /**
         * Convert NGN to kobo.
         */
        const gatewayAmount =
            Math.round(requestedAmount * 100);

        /**
         * Send refund request to Paystack.
         */
        const gatewayResponse =
            await paystackRequest(
                '/refund',
                {
                    method: 'POST',

                    body: JSON.stringify({
                        transaction: payment.reference,

                        amount: gatewayAmount,

                        currency: payment.currency,

                        ...(customerNote
                            ? {
                                customer_note:
                                    customerNote
                            }
                            : {}),

                        ...(merchantNote
                            ? {
                                merchant_note:
                                    merchantNote
                            }
                            : {})
                    })
                }
            );

        const refund = gatewayResponse.data;

        /**
         * Map Paystack status to our local status.
         */
        const refundStatusMap = {
            pending: 'pending',
            processing: 'processing',
            'needs-attention': 'needs_attention',
            failed: 'failed',
            processed: 'processed'
        };

        const localStatus =
            refundStatusMap[refund.status] ||
            'pending';

        /**
         * Store refund locally.
         */
        const refundResult = await client.query(
            `
            INSERT INTO payment_refunds (
                payment_id,
                order_id,
                provider,
                gateway_refund_id,
                amount,
                currency,
                status,
                customer_note,
                merchant_note,
                reason,
                gateway_response,
                initiated_by,
                refunded_at
            )

            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,
                $11,
                $12,
                $13
            )

            RETURNING *
            `,
            [
                payment.id,
                payment.order_id,
                'paystack',
                refund.id || null,
                requestedAmount,
                payment.currency,
                localStatus,
                customerNote,
                merchantNote,
                reason,
                refund,
                initiatedBy,
                refund.refunded_at || null
            ]
        );

        const savedRefund =
            refundResult.rows[0];

        await client.query('COMMIT');

        /**
         * If Paystack immediately reports processed,
         * finalize inventory + order state.
         */
        let finalized = null;

        if (localStatus === 'processed') {
            finalized =
                await finalizeProcessedRefund(
                    savedRefund.id
                );
        }

        return {
            refund: savedRefund,

            gateway: {
                id: refund.id,
                status: refund.status,
                amount: refund.amount,
                currency: refund.currency,
                expected_at:
                    refund.expected_at || null
            },

            finalized
        };

    } catch (error) {
        await client.query('ROLLBACK');

        throw error;

    } finally {
        client.release();
    }
};


/**
 * ============================================================
 * GET REFUNDS FOR A PAYMENT
 * ============================================================
 */

const getPaymentRefunds = async (paymentId) => {
    const paymentResult = await pool.query(
        `
        SELECT
            id,
            reference,
            amount,
            currency,
            status

        FROM payments

        WHERE id = $1
        `,
        [paymentId]
    );

    if (paymentResult.rows.length === 0) {
        const error = new Error(
            'Payment not found'
        );

        error.statusCode = 404;

        throw error;
    }

    const refundResult = await pool.query(
        `
        SELECT *

        FROM payment_refunds

        WHERE payment_id = $1

        ORDER BY created_at DESC
        `,
        [paymentId]
    );

    return {
        payment: paymentResult.rows[0],
        refunds: refundResult.rows
    };
};


/**
 * ============================================================
 * FETCH REFUND FROM PAYSTACK
 * ============================================================
 */

const fetchRefund = async (refundId) => {
    const gatewayResponse =
        await paystackRequest(
            `/refund/${refundId}`,
            {
                method: 'GET'
            }
        );

    return gatewayResponse.data;
};


/**
 * ============================================================
 * SYNCHRONIZE REFUND STATUS
 * ============================================================
 */

const syncRefundStatus = async (refundId) => {
    const gatewayRefund =
        await fetchRefund(refundId);

    const statusMap = {
        pending: 'pending',
        processing: 'processing',
        'needs-attention': 'needs_attention',
        failed: 'failed',
        processed: 'processed'
    };

    const localStatus =
        statusMap[gatewayRefund.status];

    if (!localStatus) {
        const error = new Error(
            `Unsupported Paystack refund status: ${gatewayRefund.status}`
        );

        error.statusCode = 400;

        throw error;
    }

    const result =
        await pool.query(
            `
            UPDATE payment_refunds

            SET
                status = $1,
                gateway_response = $2,

                refunded_at =
                    CASE
                        WHEN $3 = TRUE
                        THEN COALESCE(
                            $4,
                            CURRENT_TIMESTAMP
                        )
                        ELSE refunded_at
                    END,

                updated_at = CURRENT_TIMESTAMP

            WHERE gateway_refund_id = $5

            RETURNING *
            `,
            [
                localStatus,
                JSON.stringify(gatewayRefund),
                localStatus === 'processed',
                gatewayRefund.refunded_at || null,
                Number(refundId)
            ]
        );

    if (result.rows.length === 0) {
        const error = new Error(
            'Local refund record not found'
        );

        error.statusCode = 404;

        throw error;
    }

    const refund = result.rows[0];

    /**
     * Processed refunds go through the central finalization
     * workflow.
     *
     * This handles:
     *
     * - full refund detection
     * - inventory RETURN
     * - payment status
     * - order status
     * - idempotency
     */
    if (localStatus === 'processed') {
        return await finalizeProcessedRefund(
            refund.id
        );
    }

    /**
     * Non-processed refunds only return the updated record.
     */
    const orderPayment =
        await updateOrderRefundStatus(
            refund.payment_id
        );

    return {
        refund,
        orderPayment
    };
};


/**
 * ============================================================
 * HANDLE PAYSTACK REFUND WEBHOOK
 * ============================================================
 *
 * Supported events:
 *
 * refund.pending
 * refund.processing
 * refund.needs-attention
 * refund.failed
 * refund.processed
 */
const handlePaystackRefundWebhook = async (event) => {
    const refundData =
        event.data || {};

    const statusMap = {
        'refund.pending': 'pending',
        'refund.processing': 'processing',
        'refund.needs-attention': 'needs_attention',
        'refund.failed': 'failed',
        'refund.processed': 'processed'
    };

    const localStatus =
        statusMap[event.event];

    /**
     * Ignore events that are not refund events.
     */
    if (!localStatus) {
        return {
            handled: false,
            message: 'Refund event not supported'
        };
    }

    /**
     * Paystack may provide transaction reference directly
     * or inside transaction.
     */
    const transactionReference =
        refundData.transaction_reference ||
        refundData.transaction?.reference ||
        null;

    /**
     * Paystack refund reference.
     */
    const refundReference =
        refundData.refund_reference
            ? Number(refundData.refund_reference)
            : null;

    /**
     * Paystack amount is represented in kobo.
     */
    const amount =
        Number(refundData.amount || 0) / 100;

    const refundedAt =
        refundData.refunded_at || null;

    let result;

    /**
     * ========================================================
     * 1. MATCH BY EXACT PAYSTACK REFUND ID
     * ========================================================
     */
    if (refundReference) {
        result = await pool.query(
            `
            UPDATE payment_refunds

            SET
                status = $1,
                gateway_response = $2,

                refunded_at =
                    CASE
                        WHEN $3 = TRUE
                        THEN COALESCE(
                            $4,
                            CURRENT_TIMESTAMP
                        )
                        ELSE refunded_at
                    END,

                updated_at = CURRENT_TIMESTAMP

            WHERE gateway_refund_id = $5

            RETURNING *
            `,
            [
                localStatus,
                JSON.stringify(refundData),
                localStatus === 'processed',
                refundedAt,
                refundReference
            ]
        );
    }

    /**
     * ========================================================
     * 2. MATCH BY TRANSACTION REFERENCE + AMOUNT
     * ========================================================
     */
    if (
        !result ||
        result.rows.length === 0
    ) {
        if (transactionReference) {
            result = await pool.query(
                `
                UPDATE payment_refunds AS pr

                SET
                    status = $1,
                    gateway_response = $2,

                    refunded_at =
                        CASE
                            WHEN $3 = TRUE
                            THEN COALESCE(
                                $4,
                                CURRENT_TIMESTAMP
                            )
                            ELSE pr.refunded_at
                        END,

                    updated_at = CURRENT_TIMESTAMP

                FROM payments AS p

                WHERE pr.payment_id = p.id

                  AND p.reference = $5

                  AND ABS(
                      pr.amount - $6
                  ) < 0.01

                  AND pr.status IN (
                      'pending',
                      'processing',
                      'needs_attention'
                  )

                RETURNING pr.*
                `,
                [
                    localStatus,
                    JSON.stringify(refundData),
                    localStatus === 'processed',
                    refundedAt,
                    transactionReference,
                    amount
                ]
            );
        }
    }

    /**
     * ========================================================
     * 3. FINAL FALLBACK: TRANSACTION REFERENCE ONLY
     * ========================================================
     */
    if (
        !result ||
        result.rows.length === 0
    ) {
        if (transactionReference) {
            result = await pool.query(
                `
                UPDATE payment_refunds AS pr

                SET
                    status = $1,
                    gateway_response = $2,

                    refunded_at =
                        CASE
                            WHEN $3 = TRUE
                            THEN COALESCE(
                                $4,
                                CURRENT_TIMESTAMP
                            )
                            ELSE pr.refunded_at
                        END,

                    updated_at = CURRENT_TIMESTAMP

                FROM payments AS p

                WHERE pr.payment_id = p.id

                  AND p.reference = $5

                  AND pr.status IN (
                      'pending',
                      'processing',
                      'needs_attention'
                  )

                RETURNING pr.*
                `,
                [
                    localStatus,
                    JSON.stringify(refundData),
                    localStatus === 'processed',
                    refundedAt,
                    transactionReference
                ]
            );
        }
    }

    /**
     * ========================================================
     * 4. NOTHING MATCHED
     * ========================================================
     */
    if (
        !result ||
        result.rows.length === 0
    ) {
        return {
            handled: false,

            message:
                'No matching local refund found',

            received: {
                event: event.event,
                transactionReference,
                refundReference,
                amount
            }
        };
    }

    /**
     * ========================================================
     * 5. REFUND MATCHED
     * ========================================================
     */
    const refund =
        result.rows[0];

    /**
     * Processed refunds use the central finalization
     * workflow.
     */
    if (localStatus === 'processed') {
        const finalized =
            await finalizeProcessedRefund(
                refund.id
            );

        return {
            handled: true,
            refund,
            finalized
        };
    }

    /**
     * Non-processed refunds simply update payment status.
     */
    const orderPayment =
        await updateOrderRefundStatus(
            refund.payment_id
        );

    return {
        handled: true,
        refund,
        orderPayment
    };
};


/**
 * ============================================================
 * RETRY REFUND
 * ============================================================
 *
 * Used for refunds that Paystack marks as
 * needs_attention.
 */
const retryRefund = async ({
    refundId,
    currency,
    accountNumber,
    bankId
}) => {
    if (!currency) {
        const error = new Error(
            'Refund account currency is required'
        );

        error.statusCode = 400;

        throw error;
    }

    if (!accountNumber) {
        const error = new Error(
            'Refund account number is required'
        );

        error.statusCode = 400;

        throw error;
    }

    if (!bankId) {
        const error = new Error(
            'Refund bank ID is required'
        );

        error.statusCode = 400;

        throw error;
    }

    /**
     * Find local refund.
     */
    const localRefundResult =
        await pool.query(
            `
            SELECT
                id,
                payment_id,
                order_id,
                gateway_refund_id,
                status

            FROM payment_refunds

            WHERE gateway_refund_id = $1
            `,
            [Number(refundId)]
        );

    if (
        localRefundResult.rows.length === 0
    ) {
        const error = new Error(
            'Refund not found'
        );

        error.statusCode = 404;

        throw error;
    }

    const localRefund =
        localRefundResult.rows[0];

    /**
     * Retry is only valid for needs_attention.
     */
    if (
        localRefund.status !==
        'needs_attention'
    ) {
        const error = new Error(
            'Only refunds with needs_attention status can be retried'
        );

        error.statusCode = 400;

        throw error;
    }

    /**
     * Ask Paystack to retry the refund using
     * customer bank details.
     */
    const gatewayResponse =
        await paystackRequest(
            `/refund/retry_with_customer_details/${Number(refundId)}`,
            {
                method: 'POST',

                body: JSON.stringify({
                    refund_account_details: {
                        currency,
                        account_number:
                            accountNumber,
                        bank_id:
                            String(bankId)
                    }
                })
            }
        );

    const gatewayRefund =
        gatewayResponse.data;

    const statusMap = {
        pending: 'pending',
        processing: 'processing',
        'needs-attention': 'needs_attention',
        failed: 'failed',
        processed: 'processed'
    };

    const localStatus =
        statusMap[gatewayRefund.status] ||
        'processing';

    const result =
        await pool.query(
            `
            UPDATE payment_refunds

            SET
                status = $1,
                gateway_refund_id = $2,
                gateway_response = $3,
                refunded_at = $4,
                updated_at = CURRENT_TIMESTAMP

            WHERE id = $5

            RETURNING *
            `,
            [
                localStatus,

                gatewayRefund.id ||
                    Number(refundId),

                JSON.stringify(
                    gatewayRefund
                ),

                gatewayRefund.refunded_at ||
                    null,

                localRefund.id
            ]
        );

    const refund =
        result.rows[0];

    /**
     * If retry immediately results in a processed
     * refund, finalize the entire refund.
     */
    let finalized = null;

    if (localStatus === 'processed') {
        finalized =
            await finalizeProcessedRefund(
                refund.id
            );
    }

    return {
        refund,

        gateway: gatewayRefund,

        finalized
    };
};


/**
 * ============================================================
 * EXPORTS
 * ============================================================
 */

module.exports = {
    createRefund,
    getPaymentRefunds,
    fetchRefund,
    syncRefundStatus,
    handlePaystackRefundWebhook,
    retryRefund,
    updateOrderRefundStatus,
    restoreInventoryForRefund,
    finalizeProcessedRefund
};