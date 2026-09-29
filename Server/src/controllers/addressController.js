const {
    createAddress,
    getMyAddresses,
    getAddressById,
    updateAddress,
    deleteAddress
} = require('../services/addressService');


const create = async (req, res, next) => {
    try {
        const address = await createAddress(
            req.user.userId,
            req.body
        );

        res.status(201).json({
            success: true,
            message: 'Address created successfully',
            data: address
        });

    } catch (error) {
        next(error);
    }
};


const getAll = async (req, res, next) => {
    try {
        const addresses = await getMyAddresses(
            req.user.userId
        );

        res.status(200).json({
            success: true,
            data: addresses
        });

    } catch (error) {
        next(error);
    }
};


const getOne = async (req, res, next) => {
    try {
        const address = await getAddressById(
            req.user.userId,
            req.params.addressId
        );

        res.status(200).json({
            success: true,
            data: address
        });

    } catch (error) {
        next(error);
    }
};


const update = async (req, res, next) => {
    try {
        const address = await updateAddress(
            req.user.userId,
            req.params.addressId,
            req.body
        );

        res.status(200).json({
            success: true,
            message: 'Address updated successfully',
            data: address
        });

    } catch (error) {
        next(error);
    }
};


const remove = async (req, res, next) => {
    try {
        const address = await deleteAddress(
            req.user.userId,
            req.params.addressId
        );

        res.status(200).json({
            success: true,
            message: 'Address deleted successfully',
            data: address
        });

    } catch (error) {
        next(error);
    }
};


module.exports = {
    create,
    getAll,
    getOne,
    update,
    remove
};