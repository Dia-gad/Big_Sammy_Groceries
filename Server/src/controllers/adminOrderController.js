const {
    getAllOrders,
    getOrderById,
    updateOrderStatus
} = require('../services/adminOrderService');

const getOrders = async (req, res, next) => {
    try {
        const orders = await getAllOrders();

        res.status(200).json({
            success: true,
            data: orders
        });
    } catch (error) {
        next(error);
    }
};

const getOrder = async (req, res, next) => {
    try {
        const order = await getOrderById(req.params.orderId);

        res.status(200).json({
            success: true,
            data: order
        });
    } catch (error) {
        next(error);
    }
};

const changeOrderStatus = async (req, res, next) => {
    try {
        const { status } = req.body;

        const order = await updateOrderStatus(
            req.params.orderId,
            status
        );

        res.status(200).json({
            success: true,
            message: 'Order status updated successfully',
            data: order
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getOrders,
    getOrder,
    changeOrderStatus
};