const { body, param, query } = require('express-validator');

const createPayrollPeriodValidator = [
    body('periodName')
        .trim()
        .notEmpty()
        .withMessage('Period name is required')
        .isLength({ max: 100 })
        .withMessage('Period name must not exceed 100 characters'),

    body('startDate')
        .isISO8601()
        .withMessage('Valid start date is required'),

    body('endDate')
        .isISO8601()
        .withMessage('Valid end date is required'),

    body('paymentDate')
        .optional({ nullable: true })
        .isISO8601()
        .withMessage('Payment date must be a valid date')
];


const payrollPeriodIdValidator = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('Payroll period ID must be a valid positive integer')
];


const payrollPeriodStatusValidator = [
    query('status')
        .optional()
        .isIn([
            'draft',
            'processing',
            'approved',
            'paid',
            'closed',
            'cancelled'
        ])
        .withMessage('Invalid payroll period status')
];


module.exports = {
    createPayrollPeriodValidator,
    payrollPeriodIdValidator,
    payrollPeriodStatusValidator
};