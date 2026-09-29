const express = require('express');

const {
    checkout,
    getOrders,
    getOrder,
    getStatus
} = require('../controllers/orderController');

const { checkoutValidator } = require('../validators/orderValidator');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/auth');

const router = express.Router();

router.post(
    '/checkout',
    authenticate,
    checkoutValidator,
    validate,
    checkout
);

router.get(
    '/',
    authenticate,
    getOrders
);

// Order tracking
router.get(
    '/:orderId/status',
    authenticate,
    getStatus
);

// Order details
router.get(
    '/:orderId',
    authenticate,
    getOrder
);

module.exports = router;