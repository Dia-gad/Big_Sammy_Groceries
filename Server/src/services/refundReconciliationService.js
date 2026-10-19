const pool = require('../config/database');

const {
    syncRefundStatus
} = require('./refundService');


/**
 * ============================================================
 * RECONCILE PENDING REFUNDS
 * ============================================================
 *
 * Finds refunds that may still change at Paystack and
 * synchronizes them with the gateway.
 *
 * We deliberately exclude:
 *
 * - processed
 * - failed
 * - reversed
 *
 * because those are terminal states for our reconciliation
 * process.
 */
const reconcilePendingRefunds = async ({
    limit = 20
} = {}) => {

    const result = await pool.query(
        `
        SELECT
            id,
            gateway_refund_id,
            status,
            created_at,
            updated_at

        FROM payment_refunds

        WHERE status IN (
            'pending',
            'processing',
            'needs_attention'
        )

        AND gateway_refund_id IS NOT NULL

        ORDER BY created_at ASC

        LIMIT $1
        `,
        [limit]
    );

    const refunds = result.rows;

    const results = [];

    for (const refund of refunds) {
        try {
            const synchronized =
                await syncRefundStatus(
                    refund.gateway_refund_id
                );

            results.push({
                refundId: refund.id,
                gatewayRefundId:
                    refund.gateway_refund_id,
                success: true,
                result: synchronized
            });

        } catch (error) {
            /**
             * One refund failing should not prevent
             * other refunds from being reconciled.
             */
            results.push({
                refundId: refund.id,
                gatewayRefundId:
                    refund.gateway_refund_id,
                success: false,
                error: error.message
            });
        }
    }

    return {
        checked: refunds.length,
        results
    };
};


/**
 * ============================================================
 * GET REFUND RECONCILIATION CANDIDATES
 * ============================================================
 *
 * Useful for admin monitoring and debugging.
 */
const getPendingRefunds = async () => {

    const result = await pool.query(
        `
        SELECT
            pr.id,
            pr.payment_id,
            pr.order_id,
            pr.gateway_refund_id,
            pr.amount,
            pr.currency,
            pr.status,
            pr.created_at,
            pr.updated_at,

            p.reference AS payment_reference

        FROM payment_refunds pr

        JOIN payments p
            ON p.id = pr.payment_id

        WHERE pr.status IN (
            'pending',
            'processing',
            'needs_attention'
        )

        ORDER BY pr.created_at ASC
        `
    );

    return result.rows;
};


module.exports = {
    reconcilePendingRefunds,
    getPendingRefunds
};