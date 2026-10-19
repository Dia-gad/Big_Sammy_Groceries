const { body, param } = require('express-validator');

const categoryIdValidator = [
    param('categoryId')
        .isInt({ min: 1 })
        .withMessage('Category ID must be a valid positive integer')
        .toInt()
];

const createCategoryValidator = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Category name is required')
        .isLength({ max: 100 })
        .withMessage('Category name must not exceed 100 characters'),

    body('slug')
        .trim()
        .notEmpty()
        .withMessage('Category slug is required')
        .isLength({ max: 120 })
        .withMessage('Category slug must not exceed 120 characters')
        .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .withMessage(
            'Category slug must contain only lowercase letters, numbers, and hyphens'
        ),

    body('description')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Description must not exceed 1000 characters'),

    body('image_url')
        .optional({ values: 'null' })
        .trim()
        .isURL()
        .withMessage('Image URL must be a valid URL')
];

const updateCategoryValidator = [
    body('name')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Category name cannot be empty')
        .isLength({ max: 100 })
        .withMessage('Category name must not exceed 100 characters'),

    body('slug')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Category slug cannot be empty')
        .isLength({ max: 120 })
        .withMessage('Category slug must not exceed 120 characters')
        .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .withMessage(
            'Category slug must contain only lowercase letters, numbers, and hyphens'
        ),

    body('description')
        .optional({ values: 'null' })
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Description must not exceed 1000 characters'),

    body('image_url')
        .optional({ values: 'null' })
        .trim()
        .isURL()
        .withMessage('Image URL must be a valid URL'),

    body('is_active')
        .optional()
        .isBoolean()
        .withMessage('is_active must be true or false')
        .toBoolean()
];

module.exports = {
    categoryIdValidator,
    createCategoryValidator,
    updateCategoryValidator
};