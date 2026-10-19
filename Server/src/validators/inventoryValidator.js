const { param } = require('express-validator');


// ============================================================
// VARIANT ID VALIDATOR
// ============================================================

const variantIdValidator = [
    param('variantId')
        .isInt({ min: 1 })
        .withMessage('Variant ID must be a valid positive integer')
        .toInt()
];


module.exports = {
    variantIdValidator
};