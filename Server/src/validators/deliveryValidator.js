const { param, body } = require('express-validator');

const orderIdValidator = [
    param('orderId')
        .isInt({ min: 1 })
        .withMessage('Order ID must be a positive integer')
];

const assignRiderValidator = [
    body('riderId')
        .notEmpty()
        .withMessage('Rider ID is required')
        .isInt({ min: 1 })
        .withMessage('Rider ID must be a positive integer')
];

module.exports = {
    orderIdValidator,
    assignRiderValidator
};