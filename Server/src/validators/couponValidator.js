const { body, param } = require('express-validator');

const couponIdValidator = [
    param('couponId')
        .isInt({ min: 1 })
        .withMessage('Coupon ID must be a valid positive integer')
        .toInt()
];

const createCouponValidator = [
    body('code')
        .trim()
        .notEmpty()
        .withMessage('Coupon code is required')
        .isLength({ min: 3, max: 50 })
        .withMessage('Coupon code must be between 3 and 50 characters')
        .matches(/^[A-Za-z0-9_-]+$/)
        .withMessage(
            'Coupon code can only contain letters, numbers, underscores, and hyphens'
        ),

    body('description')
        .optional({ values: 'null' })
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Description must not exceed 1000 characters'),

    body('discount_type')
        .trim()
        .notEmpty()
        .withMessage('Discount type is required')
        .isIn(['percentage', 'fixed'])
        .withMessage('Discount type must be percentage or fixed'),

    body('discount_value')
        .isFloat({ gt: 0 })
        .withMessage('Discount value must be greater than 0')
        .toFloat(),

    body('minimum_order_amount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Minimum order amount cannot be negative')
        .toFloat(),

    body('maximum_discount_amount')
        .optional({ values: 'null' })
        .isFloat({ gt: 0 })
        .withMessage('Maximum discount amount must be greater than 0')
        .toFloat(),

    body('usage_limit')
        .optional({ values: 'null' })
        .isInt({ min: 1 })
        .withMessage('Usage limit must be at least 1')
        .toInt(),

    body('starts_at')
        .optional()
        .isISO8601()
        .withMessage('Start date must be a valid date and time')
        .toDate(),

    body('expires_at')
        .optional({ values: 'null' })
        .isISO8601()
        .withMessage('Expiry date must be a valid date and time')
        .toDate(),

    body('is_active')
        .optional()
        .isBoolean()
        .withMessage('is_active must be true or false')
        .toBoolean()
];

const updateCouponValidator = [
    body('code')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Coupon code cannot be empty')
        .isLength({ min: 3, max: 50 })
        .withMessage('Coupon code must be between 3 and 50 characters')
        .matches(/^[A-Za-z0-9_-]+$/)
        .withMessage(
            'Coupon code can only contain letters, numbers, underscores, and hyphens'
        ),

    body('description')
        .optional({ values: 'null' })
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Description must not exceed 1000 characters'),

    body('discount_type')
        .optional()
        .trim()
        .isIn(['percentage', 'fixed'])
        .withMessage('Discount type must be percentage or fixed'),

    body('discount_value')
        .optional()
        .isFloat({ gt: 0 })
        .withMessage('Discount value must be greater than 0')
        .toFloat(),

    body('minimum_order_amount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Minimum order amount cannot be negative')
        .toFloat(),

    body('maximum_discount_amount')
        .optional({ values: 'null' })
        .isFloat({ gt: 0 })
        .withMessage('Maximum discount amount must be greater than 0')
        .toFloat(),

    body('usage_limit')
        .optional({ values: 'null' })
        .isInt({ min: 1 })
        .withMessage('Usage limit must be at least 1')
        .toInt(),

    body('starts_at')
        .optional()
        .isISO8601()
        .withMessage('Start date must be a valid date and time')
        .toDate(),

    body('expires_at')
        .optional({ values: 'null' })
        .isISO8601()
        .withMessage('Expiry date must be a valid date and time')
        .toDate(),

    body('is_active')
        .optional()
        .isBoolean()
        .withMessage('is_active must be true or false')
        .toBoolean()
];

module.exports = {
    couponIdValidator,
    createCouponValidator,
    updateCouponValidator
};