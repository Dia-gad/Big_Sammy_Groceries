const {
    createPayrollPeriod,
    getPayrollPeriods,
    getPayrollPeriodById,
    generatePayroll
} = require('../services/payrollRunService');


const createPeriod = async (req, res, next) => {
    try {
        const {
            periodName,
            startDate,
            endDate,
            paymentDate
        } = req.body;

        /*
         * Basic date validation at business-logic level.
         */
        if (new Date(startDate) > new Date(endDate)) {
            return res.status(400).json({
                success: false,
                message: 'Start date cannot be after end date'
            });
        }

        if (
            paymentDate &&
            new Date(paymentDate) < new Date(endDate)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Payment date cannot be before the payroll end date'
            });
        }

        const period = await createPayrollPeriod({
            periodName,
            startDate,
            endDate,
            paymentDate,
            createdBy: req.user.userId
        });

        return res.status(201).json({
            success: true,
            message: 'Payroll period created successfully',
            data: period
        });

    } catch (error) {
        next(error);
    }
};


const getPeriods = async (req, res, next) => {
    try {
        const periods = await getPayrollPeriods({
            status: req.query.status
        });

        return res.status(200).json({
            success: true,
            data: periods
        });

    } catch (error) {
        next(error);
    }
};


const getPeriod = async (req, res, next) => {
    try {
        const period = await getPayrollPeriodById(
            Number(req.params.id)
        );

        return res.status(200).json({
            success: true,
            data: period
        });

    } catch (error) {
        next(error);
    }
};


const generate = async (req, res, next) => {
    try {
        const payroll = await generatePayroll({
            periodId: Number(req.params.id),
            generatedBy: req.user.userId
        });

        return res.status(200).json({
            success: true,
            message: 'Payroll generated successfully',
            data: payroll
        });

    } catch (error) {
        next(error);
    }
};


module.exports = {
    createPeriod,
    getPeriods,
    getPeriod,
    generate
};