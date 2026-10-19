const {
    createSalaryPayment,
    markSalaryPaymentPaid,
    getSalaryPaymentById,
    getPayrollPayments
} = require('../services/payrollPaymentService');


const createPayment = async (req, res, next) => {
    try {
        const {
            payrollRecordId,
            paymentMethod,
            paymentReference,
            notes
        } = req.body;

        const payment = await createSalaryPayment({
            payrollRecordId: Number(payrollRecordId),
            paymentMethod,
            paymentReference,
            processedBy: req.user.userId,
            notes
        });

        return res.status(201).json({
            success: true,
            message: 'Salary payment initiated successfully',
            data: payment
        });

    } catch (error) {
        next(error);
    }
};


const markPaid = async (req, res, next) => {
    try {
        const payment = await markSalaryPaymentPaid({
            paymentId: Number(req.params.id),
            processedBy: req.user.userId
        });

        return res.status(200).json({
            success: true,
            message: 'Salary payment marked as paid successfully',
            data: payment
        });

    } catch (error) {
        next(error);
    }
};


const getPayment = async (req, res, next) => {
    try {
        const payment = await getSalaryPaymentById(
            Number(req.params.id)
        );

        return res.status(200).json({
            success: true,
            data: payment
        });

    } catch (error) {
        next(error);
    }
};


const getPeriodPayments = async (req, res, next) => {
    try {
        const payments = await getPayrollPayments(
            Number(req.params.id)
        );

        return res.status(200).json({
            success: true,
            data: payments
        });

    } catch (error) {
        next(error);
    }
};


module.exports = {
    createPayment,
    markPaid,
    getPayment,
    getPeriodPayments
};