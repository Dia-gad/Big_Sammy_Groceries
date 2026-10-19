const {
    getAllOrders,
    getOrderById,
    updateOrderStatus,
    updateDeliveryTime
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
        const order = await getOrderById(
            req.params.orderId
        );

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


// ---------------------------------------------------------
// Change delivery scheduled time
// ---------------------------------------------------------

const changeDeliveryTime = async (req, res, next) => {
    try {
        const { delivery_scheduled_at } = req.body;

        const order = await updateDeliveryTime(
            req.params.orderId,
            delivery_scheduled_at
        );

        res.status(200).json({
            success: true,
            message: 'Delivery time updated successfully',
            data: order
        });
    } catch (error) {
        next(error);
    }
};


module.exports = {
    getOrders,
    getOrder,
    changeOrderStatus,
    changeDeliveryTime
};