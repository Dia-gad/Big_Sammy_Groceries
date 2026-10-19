const {
    getMyDeliveries,
    getMyDeliveryById,
    pickupDelivery,
    startDelivery,
    completeDelivery,
    failDelivery
} = require('../services/riderDeliveryService');


// =========================================================
// GET ALL MY DELIVERIES
// =========================================================

const getDeliveries = async (req, res, next) => {
    try {
        const deliveries =
            await getMyDeliveries(
                req.user.userId
            );

        return res.status(200).json({
            success: true,
            message:
                'Rider deliveries retrieved successfully',
            data: deliveries
        });

    } catch (error) {
        next(error);
    }
};


// =========================================================
// GET SINGLE DELIVERY
// =========================================================

const getDelivery = async (req, res, next) => {
    try {
        const assignmentId =
            Number(req.params.assignmentId);

        const delivery =
            await getMyDeliveryById({
                riderId:
                    req.user.userId,

                assignmentId
            });

        return res.status(200).json({
            success: true,
            message:
                'Delivery retrieved successfully',
            data: delivery
        });

    } catch (error) {
        next(error);
    }
};


// =========================================================
// PICK UP DELIVERY
// =========================================================

const pickup = async (req, res, next) => {
    try {
        const assignmentId =
            Number(req.params.assignmentId);

        const {
            deliveryNote
        } = req.body;

        const delivery =
            await pickupDelivery({
                riderId:
                    req.user.userId,

                assignmentId,

                deliveryNote
            });

        return res.status(200).json({
            success: true,
            message:
                'Delivery picked up successfully',
            data: delivery
        });

    } catch (error) {
        next(error);
    }
};


// =========================================================
// START DELIVERY
// =========================================================

const start = async (req, res, next) => {
    try {
        const assignmentId =
            Number(req.params.assignmentId);

        const {
            deliveryNote
        } = req.body;

        const delivery =
            await startDelivery({
                riderId:
                    req.user.userId,

                assignmentId,

                deliveryNote
            });

        return res.status(200).json({
            success: true,
            message:
                'Delivery is now out for delivery',
            data: delivery
        });

    } catch (error) {
        next(error);
    }
};


// =========================================================
// COMPLETE DELIVERY
// =========================================================

const complete = async (req, res, next) => {
    try {
        const assignmentId =
            Number(req.params.assignmentId);

        const {
            deliveryNote
        } = req.body;

        const delivery =
            await completeDelivery({
                riderId:
                    req.user.userId,

                assignmentId,

                deliveryNote
            });

        return res.status(200).json({
            success: true,
            message:
                'Delivery completed successfully',
            data: delivery
        });

    } catch (error) {
        next(error);
    }
};


// =========================================================
// REPORT DELIVERY FAILURE
// =========================================================

const fail = async (req, res, next) => {
    try {
        const assignmentId =
            Number(req.params.assignmentId);

        const {
            failureReason
        } = req.body;

        const delivery =
            await failDelivery({
                riderId:
                    req.user.userId,

                assignmentId,

                failureReason
            });

        return res.status(200).json({
            success: true,
            message:
                'Delivery failure reported successfully',
            data: delivery
        });

    } catch (error) {
        next(error);
    }
};


module.exports = {
    getDeliveries,
    getDelivery,
    pickup,
    start,
    complete,
    fail
};