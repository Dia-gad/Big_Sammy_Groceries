const { body } = require('express-validator');

const addToCartValidator = [
    body('product_id')
        .notEmpty()
        .withMessage('Product ID is required')
        .isInt({ min: 1 })
        .withMessage('Product ID must be a valid positive integer'),

    body('quantity')
        .notEmpty()
        .withMessage('Quantity is required')
        .isInt({ min: 1 })
        .withMessage('Quantity must be at least 1'),
];

const updateCartValidator = [
    body('quantity')
        .notEmpty()
        .withMessage('Quantity is required')
        .isInt({ min: 1 })
        .withMessage('Quantity must be at least 1'),
];

module.exports = {
    addToCartValidator,
    updateCartValidator,
};