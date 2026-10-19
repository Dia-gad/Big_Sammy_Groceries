const { param, body } = require('express-validator');

const userIdValidator = [
    param('userId')
        .isInt({ min: 1 })
        .withMessage('User ID must be a positive integer')
];

const changeCustomerStatusValidator = [
    ...userIdValidator,

    body('isActive')
        .isBoolean()
        .withMessage('isActive must be true or false')
        .toBoolean()
];

module.exports = {
    userIdValidator,
    changeCustomerStatusValidator
};