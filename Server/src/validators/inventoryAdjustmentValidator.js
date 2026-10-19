const {
    body,
    param,
    query
} = require('express-validator');


const createAdjustmentValidator = [
    body('variantId')
        .notEmpty()
        .withMessage('Variant ID is required')
        .isInt({ min: 1 })
        .withMessage('Variant ID must be a positive integer'),

    body('requestedStock')
        .notEmpty()
        .withMessage('Requested stock is required')
        .isInt({ min: 0 })
        .withMessage('Requested stock must be a non-negative integer'),

    body('reason')
        .notEmpty()
        .withMessage('Reason is required')
        .isString()
        .withMessage('Reason must be text')
        .trim()
        .isLength({ min: 3, max: 1000 })
        .withMessage(
            'Reason must be between 3 and 1000 characters'
        )
];


const requestIdValidator = [
    param('requestId')
        .notEmpty()
        .isInt({ min: 1 })
        .withMessage('Request ID must be a positive integer')
];


const reviewAdjustmentValidator = [
    body('reviewNote')
        .optional({ nullable: true })
        .isString()
        .withMessage('Review note must be text')
        .trim()
        .isLength({ max: 1000 })
        .withMessage(
            'Review note cannot exceed 1000 characters'
        )
];


const rejectAdjustmentValidator = [
    body('reviewNote')
        .notEmpty()
        .withMessage(
            'Review note is required when rejecting an adjustment'
        )
        .isString()
        .withMessage('Review note must be text')
        .trim()
        .isLength({ min: 3, max: 1000 })
        .withMessage(
            'Review note must be between 3 and 1000 characters'
        )
];


const adjustmentStatusValidator = [
    query('status')
        .optional()
        .isIn([
            'pending',
            'approved',
            'rejected',
            'cancelled'
        ])
        .withMessage('Invalid adjustment status')
];


module.exports = {
    createAdjustmentValidator,
    requestIdValidator,
    reviewAdjustmentValidator,
    rejectAdjustmentValidator,
    adjustmentStatusValidator
};