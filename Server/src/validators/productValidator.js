const { body, param } = require('express-validator');


/*
|--------------------------------------------------------------------------
| Product ID Validator
|--------------------------------------------------------------------------
*/

const productIdValidator = [
    param('productId')
        .isInt({ min: 1 })
        .withMessage('Product ID must be a positive integer')
        .toInt()
];


/*
|--------------------------------------------------------------------------
| Create Product Validator
|--------------------------------------------------------------------------
*/

const createProductValidator = [

    body('categoryId')
        .notEmpty()
        .withMessage('Category ID is required')
        .isInt({ min: 1 })
        .withMessage('Category ID must be a positive integer')
        .toInt(),

    body('name')
        .trim()
        .notEmpty()
        .withMessage('Product name is required')
        .isLength({ max: 255 })
        .withMessage('Product name must not exceed 255 characters'),

    body('slug')
        .trim()
        .notEmpty()
        .withMessage('Product slug is required')
        .isLength({ max: 255 })
        .withMessage('Product slug must not exceed 255 characters')
        .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .withMessage(
            'Slug can only contain lowercase letters, numbers and hyphens'
        ),

    body('description')
        .optional({ values: 'null' })
        .isString()
        .withMessage('Description must be text'),

    body('weight')
        .optional({ values: 'null' })
        .isFloat({ min: 0 })
        .withMessage('Weight must be zero or greater')
        .toFloat(),

    body('unitId')
        .notEmpty()
        .withMessage('Unit ID is required')
        .isInt({ min: 1 })
        .withMessage('Unit ID must be a positive integer')
        .toInt(),

    body('sku')
        .trim()
        .notEmpty()
        .withMessage('SKU is required')
        .isLength({ max: 100 })
        .withMessage('SKU must not exceed 100 characters'),

    body('price')
        .notEmpty()
        .withMessage('Price is required')
        .isFloat({ min: 0 })
        .withMessage('Price must be zero or greater')
        .toFloat(),

    body('stockQuantity')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Stock quantity cannot be negative')
        .toInt(),

    body('options')
    .optional()
    .isObject()
    .withMessage('Options must be a JSON object'),

body('isFeatured')
    .optional()
    .isBoolean()
    .withMessage('Featured status must be true or false')
    .toBoolean()
];


/*
|--------------------------------------------------------------------------
| Update Product Validator
|--------------------------------------------------------------------------
*/

const updateProductValidator = [

    body('categoryId')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Category ID must be a positive integer')
        .toInt(),

    body('name')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Product name cannot be empty')
        .isLength({ max: 255 })
        .withMessage('Product name must not exceed 255 characters'),

    body('slug')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Product slug cannot be empty')
        .isLength({ max: 255 })
        .withMessage('Product slug must not exceed 255 characters')
        .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .withMessage(
            'Slug can only contain lowercase letters, numbers and hyphens'
        ),

    body('description')
        .optional({ values: 'null' })
        .isString()
        .withMessage('Description must be text'),

    body('weight')
        .optional({ values: 'null' })
        .isFloat({ min: 0 })
        .withMessage('Weight must be zero or greater')
        .toFloat(),

    body('isAvailable')
        .optional()
        .isBoolean()
        .withMessage('isAvailable must be true or false')
        .toBoolean()
];


module.exports = {
    productIdValidator,
    createProductValidator,
    updateProductValidator
};