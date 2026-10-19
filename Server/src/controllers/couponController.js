const {
    getAllCoupons,
    getCouponById,
    createCoupon,
    updateCoupon,
    deleteCoupon
} = require('../services/couponService');

const getCoupons = async (req, res, next) => {
    try {
        const coupons = await getAllCoupons();

        res.status(200).json({
            success: true,
            data: coupons
        });
    } catch (error) {
        next(error);
    }
};

const getCoupon = async (req, res, next) => {
    try {
        const coupon = await getCouponById(req.params.couponId);

        res.status(200).json({
            success: true,
            data: coupon
        });
    } catch (error) {
        next(error);
    }
};

const createAdminCoupon = async (req, res, next) => {
    try {
        const coupon = await createCoupon(req.body);

        res.status(201).json({
            success: true,
            message: 'Coupon created successfully',
            data: coupon
        });
    } catch (error) {
        next(error);
    }
};

const updateAdminCoupon = async (req, res, next) => {
    try {
        const coupon = await updateCoupon(
            req.params.couponId,
            req.body
        );

        res.status(200).json({
            success: true,
            message: 'Coupon updated successfully',
            data: coupon
        });
    } catch (error) {
        next(error);
    }
};

const deleteAdminCoupon = async (req, res, next) => {
    try {
        const result = await deleteCoupon(req.params.couponId);

        res.status(200).json({
            success: true,
            message: 'Coupon deleted successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getCoupons,
    getCoupon,
    createAdminCoupon,
    updateAdminCoupon,
    deleteAdminCoupon
};