const {
    createStaffUser,
    getStaffUsers,
    getStaffUserById,
    changeStaffRole,
    changeStaffStatus
} = require('../services/adminUserService');

const createStaff = async (req, res, next) => {
    try {
        const user = await createStaffUser({
            ...req.body,
            createdBy: req.user
        });

        res.status(201).json({
            success: true,
            message: 'Staff user created successfully',
            data: user
        });
    } catch (error) {
        next(error);
    }
};

const getStaff = async (req, res, next) => {
    try {
        const users = await getStaffUsers();

        res.status(200).json({
            success: true,
            data: users
        });
    } catch (error) {
        next(error);
    }
};

const getStaffById = async (req, res, next) => {
    try {
        const user = await getStaffUserById(req.params.userId);

        res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        next(error);
    }
};

const updateStaffRole = async (req, res, next) => {
    try {
        const user = await changeStaffRole({
            userId: req.params.userId,
            role: req.body.role,
            changedBy: req.user
        });

        res.status(200).json({
            success: true,
            message: 'Staff role updated successfully',
            data: user
        });
    } catch (error) {
        next(error);
    }
};

const updateStaffStatus = async (req, res, next) => {
    try {
        const user = await changeStaffStatus({
            userId: req.params.userId,
            isActive: req.body.isActive,
            changedBy: req.user
        });

        res.status(200).json({
            success: true,
            message: `Staff account ${
                req.body.isActive ? 'activated' : 'deactivated'
            } successfully`,
            data: user
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createStaff,
    getStaff,
    getStaffById,
    updateStaffRole,
    updateStaffStatus
};