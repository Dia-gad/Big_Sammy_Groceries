const {
    getCustomers,
    getCustomerById,
    changeCustomerStatus
} = require('../services/adminCustomerService');

const getAllCustomers = async (req, res, next) => {
    try {
        const customers = await getCustomers();

        res.status(200).json({
            success: true,
            data: customers
        });
    } catch (error) {
        next(error);
    }
};

const getCustomer = async (req, res, next) => {
    try {
        const customer = await getCustomerById(
            req.params.userId
        );

        res.status(200).json({
            success: true,
            data: customer
        });
    } catch (error) {
        next(error);
    }
};

const updateCustomerStatus = async (req, res, next) => {
    try {
        const customer = await changeCustomerStatus({
            userId: req.params.userId,
            isActive: req.body.isActive
        });

        res.status(200).json({
            success: true,
            message: `Customer account ${
                req.body.isActive
                    ? 'activated'
                    : 'deactivated'
            } successfully`,
            data: customer
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllCustomers,
    getCustomer,
    updateCustomerStatus
};