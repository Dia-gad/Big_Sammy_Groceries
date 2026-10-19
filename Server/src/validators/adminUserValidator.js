const { body, param } = require('express-validator');

const createStaffValidator = [
    body('firstName')
        .trim()
        .notEmpty()
        .withMessage('First name is required')
        .isLength({ max: 100 })
        .withMessage('First name must not exceed 100 characters'),

    body('lastName')
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
        .withMessage('Enter a valid email address'),

    body('phone')
        .optional({ values: 'falsy' })
        .trim()
        .isLength({ max: 20 })
        .withMessage('Phone number must not exceed 20 characters'),

    body('password')
        .notEmpty()
        .withMessage('Password is required')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters'),

    body('role')
        .notEmpty()
        .withMessage('Role is required')
        .isIn([
            'admin',
            'manager',
            'inventory_staff',
            'rider'
        ])
        .withMessage('Invalid staff role')
];

const userIdValidator = [
    param('userId')
        .isInt({ min: 1 })
        .withMessage('User ID must be a positive integer')
];

const changeRoleValidator = [
    ...userIdValidator,

    body('role')
        .notEmpty()
        .withMessage('Role is required')
        .isIn([
            'admin',
            'manager',
            'inventory_staff',
            'rider'
        ])
        .withMessage('Invalid staff role')
];

const changeStatusValidator = [
    ...userIdValidator,

    body('isActive')
        .isBoolean()
        .withMessage('isActive must be true or false')
        .toBoolean()
];

module.exports = {
    createStaffValidator,
    userIdValidator,
    changeRoleValidator,
    changeStatusValidator
};