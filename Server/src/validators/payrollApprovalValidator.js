const { param } = require('express-validator');

const payrollApprovalPeriodIdValidator = [
    param('id')
        .isInt({ min: 1 })
        .withMessage(
            'Payroll period ID must be a valid positive integer'
        )
];

module.exports = {
    payrollApprovalPeriodIdValidator
};