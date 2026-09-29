const { body } = require('express-validator');

const registerValidator = [
    body('first_name')
        .trim()
        .notEmpty()
        .withMessage('First name is required')
        .isLength({ max: 100 })
        .withMessage('First name must not exceed 100 characters'),

    body('last_name')
        .trim()
        .notEmpty()
        .withMessage('Last name is required')
        .isLength({ max: 100 })
        .withMessage('Last name must not exceed 100 characters'),

    body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Please provide a valid email')
        .normalizeEmail(),

    body('phone')
        .optional()
        .trim()
        .isLength({ max: 20 })
        .withMessage('Phone number must not exceed 20 characters'),

    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters'),
];

const loginValidator = [
    body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Please provide a valid email')
        .normalizeEmail(),

    body('password')
        .notEmpty()
        .withMessage('Password is required'),
];

module.exports = {
    registerValidator,
    loginValidator,
};