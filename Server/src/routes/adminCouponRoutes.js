const express = require('express');

const {
    getCoupons,
    getCoupon,
    createAdminCoupon,
    updateAdminCoupon,
    deleteAdminCoupon
} = require('../controllers/couponController');

const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');

const {
    couponIdValidator,
    createCouponValidator,
    updateCouponValidator
} = require('../validators/couponValidator');

const router = express.Router();

// Get all coupons
router.get(
    '/',
    authenticate,
    authorize('admin', 'manager'),
    getCoupons
);

// Get one coupon
router.get(
    '/:couponId',
    authenticate,
    authorize('admin', 'manager'),
    couponIdValidator,
    validate,
    getCoupon
);

// Create coupon
router.post(
    '/',
    authenticate,
    authorize('admin', 'manager'),
    createCouponValidator,
    validate,
    createAdminCoupon
);

// Update coupon
router.patch(
    '/:couponId',
    authenticate,
    authorize('admin', 'manager'),
    couponIdValidator,
    updateCouponValidator,
    validate,
    updateAdminCoupon
);

// Delete coupon
router.delete(
    '/:couponId',
    authenticate,
    authorize('admin'),
    couponIdValidator,
    validate,
    deleteAdminCoupon
);

module.exports = router;