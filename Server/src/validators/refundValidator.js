const { body, param } = require('express-validator');

const refundPaymentValidator = [
    body('paymentId')
        .notEmpty()
        .withMessage('Payment ID is required')
        .isInt({ min: 1 })
        .withMessage('Payment ID must be a valid positive integer'),

    body('amount')
        .optional({ nullable: true })
        .isFloat({ min: 0.01 })
        .withMessage('Refund amount must be greater than zero'),

    body('customerNote')
        .optional({ nullable: true })
        .isString()
        .withMessage('Customer note must be text'),

    body('merchantNote')
        .optional({ nullable: true })
        .isString()
        .withMessage('Merchant note must be text'),

    body('reason')
        .optional({ nullable: true })
        .isString()
        .withMessage('Refund reason must be text')
];

const paymentIdValidator = [
    param('paymentId')
        .isInt({ min: 1 })
        .withMessage('Payment ID must be a valid positive integer')
];

const refundIdValidator = [
    param('refundId')
        .isInt({ min: 1 })
        .withMessage('Refund ID must be a valid positive integer')
];

module.exports = {
    refundPaymentValidator,
    paymentIdValidator,
    refundIdValidator
};