const { assignRider } = require('../services/deliveryService');

const assignRiderToOrder = async (req, res, next) => {
    try {
        const orderId = Number(req.params.orderId);
        const riderId = Number(req.body.riderId);

        const result = await assignRider({
            orderId,
            riderId,
            assignedBy: req.user.userId
        });

        return res.status(200).json({
            success: true,
            message: 'Rider assigned successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    assignRiderToOrder
};