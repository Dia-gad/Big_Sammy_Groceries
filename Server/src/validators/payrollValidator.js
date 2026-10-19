const {
    body,
    param,
    query
} = require('express-validator');


/**
 * Validate a positive monetary amount.
 */
const positiveAmount = (field) => {
    return body(field)
        .isFloat({
            min: 0
        })
        .withMessage(
            `${field} must be a valid amount`
        );
};


/**
 * Create salary structure.
 */
const createSalaryStructureValidator = [

    body('userId')
        .isInt({
            min: 1
        })
        .withMessage(
            'userId must be a valid staff user ID'
        ),

    positiveAmount('basicSalary'),

    body('effectiveFrom')
        .isISO8601({
            strict: true
        })
        .withMessage(
            'effectiveFrom must be a valid date'
        ),

    body('effectiveTo')
        .optional({
            nullable: true
        })
        .isISO8601({
            strict: true
        })
        .withMessage(
            'effectiveTo must be a valid date'
        ),

    body('notes')
        .optional({
            nullable: true
        })
        .isString()
        .trim()
        .isLength({
            max: 1000
        })
        .withMessage(
            'notes cannot exceed 1000 characters'
        ),

    body('allowances')
        .optional()
        .isArray()
        .withMessage(
            'allowances must be an array'
        ),

    body('allowances.*.name')
        .if(body('allowances').exists())
        .isString()
        .trim()
        .notEmpty()
        .isLength({
            max: 100
        })
        .withMessage(
            'Each allowance must have a valid name'
        ),

    body('allowances.*.amount')
        .if(body('allowances').exists())
        .isFloat({
            min: 0
        })
        .withMessage(
            'Each allowance amount must be valid'
        ),

    body('allowances.*.type')
        .optional()
        .isIn([
            'fixed',
            'percentage'
        ])
        .withMessage(
            'Allowance type must be fixed or percentage'
        ),

    body('deductions')
        .optional()
        .isArray()
        .withMessage(
            'deductions must be an array'
        ),

    body('deductions.*.name')
        .if(body('deductions').exists())
        .isString()
        .trim()
        .notEmpty()
        .isLength({
            max: 100
        })
        .withMessage(
            'Each deduction must have a valid name'
        ),

    body('deductions.*.amount')
        .if(body('deductions').exists())
        .isFloat({
            min: 0
        })
        .withMessage(
            'Each deduction amount must be valid'
        ),

    body('deductions.*.type')
        .optional()
        .isIn([
            'fixed',
            'percentage'
        ])
        .withMessage(
            'Deduction type must be fixed or percentage'
        )
];


/**
 * Validate salary structure ID.
 */
const salaryStructureIdValidator = [
    param('id')
        .isInt({
            min: 1
        })
        .withMessage(
            'Salary structure ID must be valid'
        )
];


/**
 * Validate staff user ID.
 */
const staffUserIdValidator = [
    param('userId')
        .isInt({
            min: 1
        })
        .withMessage(
            'User ID must be valid'
        )
];


/**
 * Validate salary status filter.
 */
const salaryStatusValidator = [
    query('status')
        .optional()
        .isIn([
            'active',
            'inactive'
        ])
        .withMessage(
            'status must be active or inactive'
        )
];


module.exports = {
    createSalaryStructureValidator,
    salaryStructureIdValidator,
    staffUserIdValidator,
    salaryStatusValidator
};