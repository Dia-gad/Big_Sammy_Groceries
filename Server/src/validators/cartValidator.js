const { body } = require('express-validator');

const addToCartValidator = [
    body('variantId')
        .notEmpty()
        .withMessage('Variant ID is required')
        .isInt({ min: 1 })
        .withMessage('Variant ID must be a positive integer'),

    body('quantity')
        .notEmpty()
        .withMessage('Quantity is required')
        .isInt({ min: 1 })
        .withMessage('Quantity must be at least 1')
];

const updateCartValidator = [
    body('quantity')
        .notEmpty()
        .withMessage('Quantity is required')
        .isInt({ min: 1 })
        .withMessage('Quantity must be at least 1')
];

module.exports = {
    addToCartValidator,
    updateCartValidator
};