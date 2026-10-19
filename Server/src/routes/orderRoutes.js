const express = require('express');

const {
    checkout,
    getOrders,
    getOrder,
    getStatus,
    cancelMyOrder
} = require('../controllers/orderController');

const { checkoutValidator } = require('../validators/orderValidator');

const validate = require('../middleware/validate');
const authenticate = require('../middleware/auth');

const router = express.Router();

/**
 * Create a new order from the authenticated user's cart
 *
 * POST /api/orders/checkout
 */
router.post(
    '/checkout',
    authenticate,
    checkoutValidator,
    validate,
    checkout
);

/**
 * Get all orders belonging to the authenticated customer
 *
 * GET /api/orders
 */
router.get(
    '/',
    authenticate,
    getOrders
);

/**
 * Get the status of a specific order
 *
 * GET /api/orders/:orderId/status
 */
router.get(
    '/:orderId/status',
    authenticate,
    getStatus
);

/**
 * Cancel an unpaid pending order
 *
 * PATCH /api/orders/:orderId/cancel
 */
router.patch(
    '/:orderId/cancel',
    authenticate,
    cancelMyOrder
);

/**
 * Get complete details of a specific order
 *
 * GET /api/orders/:orderId
 */
router.get(
    '/:orderId',
    authenticate,
    getOrder
);

module.exports = router;