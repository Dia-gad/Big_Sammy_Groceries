const {
    approvePayroll,
    getPayrollApprovalSummary
} = require('../services/payrollApprovalService');


const approve = async (req, res, next) => {
    try {
        const periodId = Number(req.params.id);

        const payroll = await approvePayroll({
            periodId,
            approvedBy: req.user.userId
        });

        return res.status(200).json({
            success: true,
            message: 'Payroll approved successfully',
            data: payroll
        });

    } catch (error) {
        next(error);
    }
};


const getApprovalSummary = async (req, res, next) => {
    try {
        const periodId = Number(req.params.id);

        const summary = await getPayrollApprovalSummary(
            periodId
        );

        return res.status(200).json({
            success: true,
            data: summary
        });

    } catch (error) {
        next(error);
    }
};


module.exports = {
    approve,
    getApprovalSummary
};