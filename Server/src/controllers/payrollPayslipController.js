const {
    generatePayslip,
    getPayslipById,
    getPayslipByPayrollRecord
} = require('../services/payrollPayslipService');


/**
 * Generate payslip.
 */
const generate = async (req, res, next) => {
    try {
        const payslip = await generatePayslip({
            payrollRecordId: Number(
                req.params.payrollRecordId
            ),
            generatedBy: req.user.userId
        });

        return res.status(201).json({
            success: true,
            message: payslip.already_existed
                ? 'Payslip already exists'
                : 'Payslip generated successfully',
            data: payslip
        });

    } catch (error) {
        next(error);
    }
};


/**
 * Get payslip by ID.
 */
const getPayslip = async (req, res, next) => {
    try {
        const payslip = await getPayslipById(
            Number(req.params.id)
        );

        return res.status(200).json({
            success: true,
            data: payslip
        });

    } catch (error) {
        next(error);
    }
};


/**
 * Get payslip by payroll record.
 */
const getByPayrollRecord = async (
    req,
    res,
    next
) => {
    try {
        const payslip =
            await getPayslipByPayrollRecord(
                Number(req.params.payrollRecordId)
            );

        return res.status(200).json({
            success: true,
            data: payslip
        });

    } catch (error) {
        next(error);
    }
};


module.exports = {
    generate,
    getPayslip,
    getByPayrollRecord
};