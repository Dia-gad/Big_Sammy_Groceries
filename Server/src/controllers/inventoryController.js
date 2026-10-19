const {
    getInventory,
    getVariantInventory,
    getInventoryMovements
} = require('../services/inventoryService');

const getAllInventory = async (req, res, next) => {
    try {
        const inventory = await getInventory();

        res.status(200).json({
            success: true,
            data: inventory
        });
    } catch (error) {
        next(error);
    }
};

const getSingleVariantInventory = async (req, res, next) => {
    try {
        const inventory = await getVariantInventory(
            req.params.variantId
        );

        res.status(200).json({
            success: true,
            data: inventory
        });
    } catch (error) {
        next(error);
    }
};

const getVariantMovements = async (req, res, next) => {
    try {
        const movements = await getInventoryMovements(
            req.params.variantId
        );

        res.status(200).json({
            success: true,
            data: movements
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllInventory,
    getSingleVariantInventory,
    getVariantMovements
};