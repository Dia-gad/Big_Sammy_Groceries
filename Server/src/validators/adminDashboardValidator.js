const { query } = require('express-validator');

const salesOverviewValidator = [
    query('startDate')
        .optional()
        .isISO8601({ strict: true })
        .withMessage(
            'startDate must be a valid date in YYYY-MM-DD format'
        ),

    query('endDate')
        .optional()
        .isISO8601({ strict: true })
        .withMessage(
            'endDate must be a valid date in YYYY-MM-DD format'
        ),

    query('endDate')
        .custom((endDate, { req }) => {
            if (
                req.query.startDate &&
                endDate &&
                new Date(endDate) < new Date(req.query.startDate)
            ) {
                throw new Error(
                    'endDate cannot be earlier than startDate'
                );
            }

            return true;
        })
];

module.exports = {
    salesOverviewValidator
};