const { body, param } = require('express-validator');


// ============================================================
// CREATE REVIEW VALIDATOR
// ============================================================

const createReviewValidator = [
    body('product_id')
        .notEmpty()
        .withMessage('Product ID is required')
        .isInt({ min: 1 })
        .withMessage('Product ID must be a valid positive integer')
        .toInt(),

    body('order_item_id')
        .notEmpty()
        .withMessage('Order item ID is required')
        .isInt({ min: 1 })
        .withMessage('Order item ID must be a valid positive integer')
        .toInt(),

    body('rating')
        .notEmpty()
        .withMessage('Rating is required')
        .isInt({ min: 1, max: 5 })
        .withMessage('Rating must be an integer between 1 and 5')
        .toInt(),

    body('review')
        .optional({ nullable: true })
        .isString()
        .withMessage('Review must be text')
        .trim()
        .isLength({ max: 2000 })
        .withMessage('Review must not exceed 2000 characters')
];


// ============================================================
// REVIEW ID VALIDATOR
// ============================================================

const reviewIdValidator = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('Review ID must be a valid positive integer')
        .toInt()
];


// ============================================================
// PRODUCT ID VALIDATOR
// ============================================================

const productIdValidator = [
    param('productId')
        .isInt({ min: 1 })
        .withMessage('Product ID must be a valid positive integer')
        .toInt()
];


// ============================================================
// UPDATE REVIEW VALIDATOR
// ============================================================

const updateReviewValidator = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('Review ID must be a valid positive integer')
        .toInt(),

    body('rating')
        .notEmpty()
        .withMessage('Rating is required')
        .isInt({ min: 1, max: 5 })
        .withMessage('Rating must be an integer between 1 and 5')
        .toInt(),

    body('review')
        .optional({ nullable: true })
        .isString()
        .withMessage('Review must be text')
        .trim()
        .isLength({ max: 2000 })
        .withMessage('Review must not exceed 2000 characters')
];


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    createReviewValidator,
    reviewIdValidator,
    productIdValidator,
    updateReviewValidator
};