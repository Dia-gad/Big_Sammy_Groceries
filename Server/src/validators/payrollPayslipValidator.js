const { param } = require('express-validator');

// ============================================================
// PAYSLIP ID VALIDATOR
// ============================================================

const payslipIdValidator = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('Payslip ID must be a valid positive integer')
];

// ============================================================
// PAYROLL RECORD ID VALIDATOR
// ============================================================

const payrollRecordIdValidator = [
    param('payrollRecordId')
        .isInt({ min: 1 })
        .withMessage('Payroll record ID must be a valid positive integer')
];

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    payslipIdValidator,
    payrollRecordIdValidator
};