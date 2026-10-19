const {
    createSalaryStructure,
    getSalaryStructures,
    getSalaryStructureById,
    getStaffSalaryStructures,
    deactivateSalaryStructure
} = require('../services/payrollService');


/**
 * Create salary structure.
 */
const createSalary = async (
    req,
    res,
    next
) => {
    try {

        const salaryStructure =
            await createSalaryStructure({
                userId: req.body.userId,

                basicSalary: req.body.basicSalary,

                effectiveFrom:
                    req.body.effectiveFrom,

                effectiveTo:
                    req.body.effectiveTo || null,

                notes:
                    req.body.notes || null,

                allowances:
                    req.body.allowances || [],

                deductions:
                    req.body.deductions || [],

                createdBy: req.user.userId
            });


        res.status(201).json({
            success: true,
            message:
                'Salary structure created successfully',
            data: salaryStructure
        });

    } catch (error) {
        next(error);
    }
};


/**
 * Get all salary structures.
 */
const getSalaries = async (
    req,
    res,
    next
) => {
    try {

        const salaries =
            await getSalaryStructures({
                status:
                    req.query.status || null
            });


        res.status(200).json({
            success: true,

            filters: {
                status:
                    req.query.status || null
            },

            data: salaries
        });

    } catch (error) {
        next(error);
    }
};


/**
 * Get one salary structure.
 */
const getSalary = async (
    req,
    res,
    next
) => {
    try {

        const salary =
            await getSalaryStructureById(
                req.params.id
            );


        res.status(200).json({
            success: true,
            data: salary
        });

    } catch (error) {
        next(error);
    }
};


/**
 * Get salary history for a staff member.
 */
const getStaffSalaries = async (
    req,
    res,
    next
) => {
    try {

        const salaries =
            await getStaffSalaryStructures(
                req.params.userId
            );


        res.status(200).json({
            success: true,
            data: salaries
        });

    } catch (error) {
        next(error);
    }
};


/**
 * Deactivate salary structure.
 */
const deactivateSalary = async (
    req,
    res,
    next
) => {
    try {

        const salary =
            await deactivateSalaryStructure(
                req.params.id
            );


        res.status(200).json({
            success: true,

            message:
                'Salary structure deactivated successfully',

            data: salary
        });

    } catch (error) {
        next(error);
    }
};


module.exports = {
    createSalary,
    getSalaries,
    getSalary,
    getStaffSalaries,
    deactivateSalary
};