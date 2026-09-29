const express = require('express');

const {
    getOrders,
    getOrder,
    changeOrderStatus
} = require('../controllers/adminOrderController');

const {
    updateOrderStatusValidator
} = require('../validators/adminOrderValidator');

const validate = require('../middleware/validate');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.get(
    '/',
    authenticate,
    authorize('admin'),
    getOrders
);

router.get(
    '/:orderId',
    authenticate,
    authorize('admin'),
    getOrder
);

router.patch(
    '/:orderId/status',
    authenticate,
    authorize('admin'),
    updateOrderStatusValidator,
    validate,
    changeOrderStatus
);

module.exports = router;