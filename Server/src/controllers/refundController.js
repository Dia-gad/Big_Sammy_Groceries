const {
    createRefund,
    getPaymentRefunds,
    fetchRefund,
    syncRefundStatus,
    retryRefund
} = require('../services/refundService');

const {
    reconcilePendingRefunds,
    getPendingRefunds
} = require('../services/refundReconciliationService');


/**
 * ============================================================
 * CREATE REFUND
 * ============================================================
 *
 * POST /api/admin/refunds
 *
 * Creates a partial or full refund.
 *
 * Only administrators are allowed to initiate refunds.
 */
const refundPayment = async (req, res, next) => {
    try {
        const {
            paymentId,
            amount,
            customerNote,
            merchantNote,
            reason
        } = req.body;

        const result = await createRefund({
            paymentId: Number(paymentId),
            amount:
                amount === undefined ||
                amount === null ||
                amount === ''
                    ? null
                    : Number(amount),
            customerNote:
                customerNote || null,
            merchantNote:
                merchantNote || null,
            reason:
                reason || null,
            initiatedBy: req.user.userId
        });

        res.status(201).json({
            success: true,
            message: 'Refund initiated successfully',
            data: result
        });

    } catch (error) {
        next(error);
    }
};


/**
 * ============================================================
 * GET REFUNDS FOR A PAYMENT
 * ============================================================
 *
 * GET /api/admin/refunds/payment/:paymentId
 */
const getRefunds = async (req, res, next) => {
    try {
        const paymentId =
            Number(req.params.paymentId);

        const result =
            await getPaymentRefunds(paymentId);

        res.status(200).json({
            success: true,
            data: result
        });

    } catch (error) {
        next(error);
    }
};


/**
 * ============================================================
 * GET REFUND FROM PAYSTACK
 * ============================================================
 *
 * GET /api/admin/refunds/:refundId
 */
const getRefund = async (req, res, next) => {
    try {
        const refundId =
            Number(req.params.refundId);

        const refund =
            await fetchRefund(refundId);

        res.status(200).json({
            success: true,
            data: {
                refund
            }
        });

    } catch (error) {
        next(error);
    }
};


/**
 * ============================================================
 * SYNCHRONIZE REFUND STATUS
 * ============================================================
 *
 * POST /api/admin/refunds/:refundId/sync
 *
 * This checks Paystack and synchronizes the local refund.
 *
 * If the refund becomes processed:
 *
 * - Full refund is detected
 * - Inventory is restored
 * - RETURN movement is recorded
 * - Payment status is updated
 * - Order status is updated where appropriate
 */
const syncRefund = async (req, res, next) => {
    try {
        const refundId =
            Number(req.params.refundId);

        const result =
            await syncRefundStatus(refundId);

        res.status(200).json({
            success: true,
            message:
                'Refund status synchronized successfully',
            data: result
        });

    } catch (error) {
        next(error);
    }
};


/**
 * ============================================================
 * RETRY REFUND
 * ============================================================
 *
 * POST /api/admin/refunds/:refundId/retry
 *
 * Used only when Paystack returns:
 *
 * needs_attention
 */
const retryRefundPayment = async (req, res, next) => {
    try {
        const refundId =
            Number(req.params.refundId);

        const {
            currency,
            accountNumber,
            bankId
        } = req.body;

        const result =
            await retryRefund({
                refundId,
                currency,
                accountNumber,
                bankId
            });

        res.status(200).json({
            success: true,
            message:
                'Refund retry submitted successfully',
            data: result
        });

    } catch (error) {
        next(error);
    }
};


/**
 * ============================================================
 * GET PENDING REFUNDS
 * ============================================================
 *
 * GET /api/admin/refunds/pending
 *
 * Returns refunds that may still change at Paystack.
 */
const getPendingRefundList = async (req, res, next) => {
    try {
        const refunds =
            await getPendingRefunds();

        res.status(200).json({
            success: true,
            data: {
                refunds
            }
        });

    } catch (error) {
        next(error);
    }
};


/**
 * ============================================================
 * RECONCILE PENDING REFUNDS
 * ============================================================
 *
 * POST /api/admin/refunds/reconcile
 *
 * Checks pending/processing/needs_attention refunds
 * against Paystack.
 *
 * The reconciliation service is designed so one failed
 * refund does not stop the remaining refunds from being
 * checked.
 */
const reconcileRefunds = async (req, res, next) => {
    try {
        const limit =
            req.body?.limit === undefined
                ? 20
                : Number(req.body.limit);

        const result =
            await reconcilePendingRefunds({
                limit
            });

        res.status(200).json({
            success: true,
            message:
                'Pending refunds reconciled successfully',
            data: result
        });

    } catch (error) {
        next(error);
    }
};


/**
 * ============================================================
 * EXPORTS
 * ============================================================
 */

module.exports = {
    refundPayment,
    getRefunds,
    getRefund,
    syncRefund,
    retryRefundPayment,
    getPendingRefundList,
    reconcileRefunds
};