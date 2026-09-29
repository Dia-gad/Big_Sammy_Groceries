const { body } = require('express-validator');

const createAddressValidator = [
    body('label')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('Label must not exceed 50 characters'),

    body('recipient_name')
        .trim()
        .notEmpty()
        .withMessage('Recipient name is required')
        .isLength({ max: 150 })
        .withMessage('Recipient name must not exceed 150 characters'),

    body('phone')
        .trim()
        .notEmpty()
        .withMessage('Phone number is required')
        .isLength({ max: 20 })
        .withMessage('Phone number must not exceed 20 characters'),

    body('address_line')
        .trim()
        .notEmpty()
        .withMessage('Address is required')
        .isLength({ max: 255 })
        .withMessage('Address must not exceed 255 characters'),

    body('city')
        .trim()
        .notEmpty()
        .withMessage('City is required')
        .isLength({ max: 100 })
        .withMessage('City must not exceed 100 characters'),

    body('state')
        .trim()
        .notEmpty()
        .withMessage('State is required')
        .isLength({ max: 100 })
        .withMessage('State must not exceed 100 characters'),

    body('landmark')
        .optional()
        .trim()
        .isLength({ max: 255 })
        .withMessage('Landmark must not exceed 255 characters'),

    body('is_default')
        .optional()
        .isBoolean()
        .withMessage('is_default must be true or false')
];


const updateAddressValidator = [
    body('label')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('Label must not exceed 50 characters'),

    body('recipient_name')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Recipient name cannot be empty'),

    body('phone')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Phone number cannot be empty'),

    body('address_line')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Address cannot be empty'),

    body('city')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('City cannot be empty'),

    body('state')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('State cannot be empty'),

    body('landmark')
        .optional()
        .trim(),

    body('is_default')
        .optional()
        .isBoolean()
        .withMessage('is_default must be true or false')
];


module.exports = {
    createAddressValidator,
    updateAddressValidator
};