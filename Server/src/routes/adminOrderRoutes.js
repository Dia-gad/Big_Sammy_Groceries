const express = require('express');

const {
    getOrders,
    getOrder,
    changeOrderStatus,
    changeDeliveryTime
} = require('../controllers/adminOrderController');

const {
    orderIdValidator,
    updateOrderStatusValidator,
    updateDeliveryTimeValidator
} = require('../validators/adminOrderValidator');

const validate = require('../middleware/validate');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = express.Router();

// Get all orders
router.get(
    '/',
    authenticate,
    authorize('admin'),
    getOrders
);

// Get single order
router.get(
    '/:orderId',
    authenticate,
    authorize('admin'),
    orderIdValidator,
    validate,
    getOrder
);

// Update order status
router.patch(
    '/:orderId/status',
    authenticate,
    authorize('admin'),
    orderIdValidator,
    updateOrderStatusValidator,
    validate,
    changeOrderStatus
);

// Update scheduled delivery time
// Only admin and manager can change delivery time
router.patch(
    '/:orderId/delivery-time',
    authenticate,
    authorize('admin', 'manager'),
    orderIdValidator,
    updateDeliveryTimeValidator,
    validate,
    changeDeliveryTime
);

module.exports = router;