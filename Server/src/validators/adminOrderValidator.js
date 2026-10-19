const { body, param } = require('express-validator');

const orderIdValidator = [
    param('orderId')
        .isInt({ min: 1 })
        .withMessage('Order ID must be a valid positive integer')
        .toInt()
];

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

const updateDeliveryTimeValidator = [
    body('delivery_scheduled_at')
        .notEmpty()
        .withMessage('Delivery time is required')
        .isISO8601()
        .withMessage('Delivery time must be a valid date and time')
        .toDate()
];

module.exports = {
    orderIdValidator,
    updateOrderStatusValidator,
    updateDeliveryTimeValidator
};