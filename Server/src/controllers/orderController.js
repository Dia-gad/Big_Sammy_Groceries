const {
    createOrder,
    getMyOrders,
    getMyOrderById,
    getOrderStatus
} = require('../services/orderService');


const checkout = async (req, res, next) => {
    try {
        const order = await createOrder(
            req.user.userId,
            req.body
        );

        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            data: order
        });

    } catch (error) {
        next(error);
    }
};


const getOrders = async (req, res, next) => {
    try {
        const orders = await getMyOrders(
            req.user.userId
        );

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
        const order = await getMyOrderById(
            req.user.userId,
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

const getStatus = async (req, res, next) => {
    try {
        const status = await getOrderStatus(
            req.user.userId,
            req.params.orderId
        );

        res.status(200).json({
            success: true,
            data: status
        });

    } catch (error) {
        next(error);
    }
};

module.exports = {
    checkout,
    getOrders,
    getOrder,
    getStatus
};