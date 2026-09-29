const { body } = require('express-validator');

const addToWishlistValidator = [
    body('product_id')
        .notEmpty()
        .withMessage('Product ID is required')
        .isInt({ min: 1 })
        .withMessage('Product ID must be a valid positive integer')
];

module.exports = {
    addToWishlistValidator
};