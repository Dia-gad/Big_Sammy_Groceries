const {
    param,
    body
} = require('express-validator');


// =========================================================
// ASSIGNMENT ID
// =========================================================

const assignmentIdValidator = [
    param('assignmentId')
        .isInt({ min: 1 })
        .withMessage(
            'Assignment ID must be a positive integer'
        )
];


// =========================================================
// DELIVERY NOTE
// =========================================================

const deliveryNoteValidator = [
    ...assignmentIdValidator,

    body('deliveryNote')
        .optional({ nullable: true })
        .isString()
        .withMessage(
            'Delivery note must be a string'
        )
        .trim()
        .isLength({ max: 500 })
        .withMessage(
            'Delivery note must not exceed 500 characters'
        )
];


// =========================================================
// FAILURE
// =========================================================

const failureValidator = [
    ...assignmentIdValidator,

    body('failureReason')
        .notEmpty()
        .withMessage(
            'Failure reason is required'
        )
        .isString()
        .withMessage(
            'Failure reason must be a string'
        )
        .trim()
        .isLength({ min: 3, max: 500 })
        .withMessage(
            'Failure reason must be between 3 and 500 characters'
        )
];


module.exports = {
    assignmentIdValidator,
    deliveryNoteValidator,
    failureValidator
};