const { body } = require('express-validator');


// ============================================================
// UPDATE PROFILE VALIDATOR
// ============================================================

const updateProfileValidator = [
    body('first_name')
        .trim()
        .notEmpty()
        .withMessage('First name is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('First name must be between 2 and 100 characters'),

    body('last_name')
        .trim()
        .notEmpty()
        .withMessage('Last name is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Last name must be between 2 and 100 characters'),

    body('phone')
        .optional({ nullable: true })
        .trim()
        .isLength({ max: 20 })
        .withMessage('Phone number must not exceed 20 characters')
];


// ============================================================
// CHANGE PASSWORD VALIDATOR
// ============================================================

const changePasswordValidator = [
    body('current_password')
        .notEmpty()
        .withMessage('Current password is required'),

    body('new_password')
        .notEmpty()
        .withMessage('New password is required')
        .isLength({ min: 8 })
        .withMessage('New password must be at least 8 characters long'),

    body('confirm_password')
        .notEmpty()
        .withMessage('Password confirmation is required')
        .custom((value, { req }) => {
            if (value !== req.body.new_password) {
                throw new Error('Passwords do not match');
            }

            return true;
        })
];


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    updateProfileValidator,
    changePasswordValidator
};