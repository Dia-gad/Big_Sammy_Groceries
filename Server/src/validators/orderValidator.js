const { body } = require('express-validator');


const checkoutValidator = [

    body('fulfillment_method')
        .trim()
        .notEmpty()
        .withMessage('Fulfillment method is required')
        .isIn(['delivery', 'pickup'])
        .withMessage(
            'Fulfillment method must be delivery or pickup'
        ),


    body('address_id')
        .optional()
        .isInt({ min: 1 })
        .withMessage(
            'Address ID must be a valid positive integer'
        ),


    body('notes')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage(
            'Notes must not exceed 1000 characters'
        )
];


module.exports = {
    checkoutValidator
};