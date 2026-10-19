const express = require('express');

const {
    refundPayment,
    getRefunds,
    getRefund,
    syncRefund,
    retryRefundPayment,
    getPendingRefundList,
    reconcileRefunds
} = require('../controllers/refundController');

const {
    refundPaymentValidator,
    paymentIdValidator,
    refundIdValidator
} = require('../validators/refundValidator');

const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');

const router = express.Router();


/**
 * ============================================================
 * CREATE REFUND
 * ============================================================
 *
 * POST /api/admin/refunds
 *
 * Partial or full refund.
 */
router.post(
    '/',
    authenticate,
    authorize('admin'),
    refundPaymentValidator,
    validate,
    refundPayment
);


/**
 * ============================================================
 * GET PENDING REFUNDS
 * ============================================================
 *
 * GET /api/admin/refunds/pending
 *
 * IMPORTANT:
 * This route must come BEFORE /:refundId.
 */
router.get(
    '/pending',
    authenticate,
    authorize('admin'),
    getPendingRefundList
);


/**
 * ============================================================
 * RECONCILE PENDING REFUNDS
 * ============================================================
 *
 * POST /api/admin/refunds/reconcile
 *
 * IMPORTANT:
 * This route must come BEFORE /:refundId.
 */
router.post(
    '/reconcile',
    authenticate,
    authorize('admin'),
    reconcileRefunds
);


/**
 * ============================================================
 * GET REFUNDS FOR A PAYMENT
 * ============================================================
 *
 * GET /api/admin/refunds/payment/:paymentId
 */
router.get(
    '/payment/:paymentId',
    authenticate,
    authorize('admin'),
    paymentIdValidator,
    validate,
    getRefunds
);


/**
 * ============================================================
 * GET REFUND
 * ============================================================
 *
 * GET /api/admin/refunds/:refundId
 */
router.get(
    '/:refundId',
    authenticate,
    authorize('admin'),
    refundIdValidator,
    validate,
    getRefund
);


/**
 * ============================================================
 * SYNCHRONIZE REFUND
 * ============================================================
 *
 * POST /api/admin/refunds/:refundId/sync
 */
router.post(
    '/:refundId/sync',
    authenticate,
    authorize('admin'),
    refundIdValidator,
    validate,
    syncRefund
);


/**
 * ============================================================
 * RETRY REFUND
 * ============================================================
 *
 * POST /api/admin/refunds/:refundId/retry
 */
router.post(
    '/:refundId/retry',
    authenticate,
    authorize('admin'),
    refundIdValidator,
    validate,
    retryRefundPayment
);


module.exports = router;