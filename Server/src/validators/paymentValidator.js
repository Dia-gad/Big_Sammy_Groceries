const { body } = require('express-validator');

const initializePaymentValidator = [
    body('orderId')
        .notEmpty()
        .withMessage('Order ID is required')
        .isInt({ min: 1 })
        .withMessage('Order ID must be a valid number')
];

module.exports = {
    initializePaymentValidator
};