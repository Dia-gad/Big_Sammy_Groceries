const { body } = require('express-validator');

const updateOrderStatusValidator = [
    body('status')
        .trim()
        .notEmpty()
        .withMessage('Order status is required')
        .isIn([
            'confirmed',
            'processing',
            'ready',
            'out_for_delivery',
            'delivered',
            'picked_up',
            'cancelled'
        ])
        .withMessage('Invalid order status')
];

module.exports = {
    updateOrderStatusValidator
};