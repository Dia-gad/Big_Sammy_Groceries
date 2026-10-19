const {
    body,
    param,
    query
} = require('express-validator');


const createSalaryPaymentValidator = [
    body('payrollRecordId')
        .isInt({ min: 1 })
        .withMessage(
            'Payroll record ID must be a valid positive integer'
        ),

    body('paymentMethod')
        .isIn([
            'bank_transfer',
            'cash',
            'other'
        ])
        .withMessage(
            'Payment method must be bank_transfer, cash, or other'
        ),

    body('paymentReference')
        .trim()
        .notEmpty()
        .withMessage(
            'Payment reference is required'
        )
        .isLength({
            min: 3,
            max: 100
        })
        .withMessage(
            'Payment reference must be between 3 and 100 characters'
        ),

    body('notes')
        .optional({ nullable: true })
        .trim()
        .isLength({ max: 500 })
        .withMessage(
            'Notes must not exceed 500 characters'
        )
];


const salaryPaymentIdValidator = [
    param('id')
        .isInt({ min: 1 })
        .withMessage(
            'Payment ID must be a valid positive integer'
        )
];


const payrollPaymentPeriodIdValidator = [
    param('id')
        .isInt({ min: 1 })
        .withMessage(
            'Payroll period ID must be a valid positive integer'
        )
];


module.exports = {
    createSalaryPaymentValidator,
    salaryPaymentIdValidator,
    payrollPaymentPeriodIdValidator
};