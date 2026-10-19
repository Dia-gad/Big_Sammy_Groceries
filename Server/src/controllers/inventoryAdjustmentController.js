const {
    requestAdjustment,
    approveAdjustment,
    rejectAdjustment,
    getAdjustmentRequest,
    getAdjustmentRequests
} = require('../services/inventoryAdjustmentService');


const createAdjustmentRequest = async (req, res, next) => {
    try {
        const {
            variantId,
            requestedStock,
            reason
        } = req.body;

        const result = await requestAdjustment({
            variantId,
            requestedStock,
            reason,
            requestedBy: req.user.userId
        });

        res.status(201).json({
            success: true,
            message: 'Inventory adjustment request submitted successfully',
            data: result
        });

    } catch (error) {
        next(error);
    }
};


const approveInventoryAdjustment = async (req, res, next) => {
    try {
        const {
            reviewNote
        } = req.body;

        const result = await approveAdjustment({
            requestId: req.params.requestId,
            reviewedBy: req.user.userId,
            reviewNote
        });

        res.status(200).json({
            success: true,
            message: 'Inventory adjustment approved successfully',
            data: result
        });

    } catch (error) {
        next(error);
    }
};


const rejectInventoryAdjustment = async (req, res, next) => {
    try {
        const {
            reviewNote
        } = req.body;

        const result = await rejectAdjustment({
            requestId: req.params.requestId,
            reviewedBy: req.user.userId,
            reviewNote
        });

        res.status(200).json({
            success: true,
            message: 'Inventory adjustment rejected successfully',
            data: result
        });

    } catch (error) {
        next(error);
    }
};


const getSingleAdjustmentRequest = async (req, res, next) => {
    try {
        const result = await getAdjustmentRequest(
            req.params.requestId
        );

        res.status(200).json({
            success: true,
            data: result
        });

    } catch (error) {
        next(error);
    }
};


const getAllAdjustmentRequests = async (req, res, next) => {
    try {
        const result = await getAdjustmentRequests({
            status: req.query.status || null
        });

        res.status(200).json({
            success: true,
            data: result
        });

    } catch (error) {
        next(error);
    }
};


module.exports = {
    createAdjustmentRequest,
    approveInventoryAdjustment,
    rejectInventoryAdjustment,
    getSingleAdjustmentRequest,
    getAllAdjustmentRequests
};