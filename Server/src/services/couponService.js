const pool = require('../config/database');

const normalizeCouponCode = (code) => {
    return code.trim().toUpperCase();
};

const getAllCoupons = async () => {
    const result = await pool.query(`
        SELECT
            id,
            code,
            description,
            discount_type,
            discount_value,
            minimum_order_amount,
            maximum_discount_amount,
            usage_limit,
            usage_count,
            starts_at,
            expires_at,
            is_active,
            created_at,
            updated_at
        FROM coupons
        ORDER BY created_at DESC
    `);

    return result.rows;
};

const getCouponById = async (couponId) => {
    const result = await pool.query(
        `
        SELECT
            id,
            code,
            description,
            discount_type,
            discount_value,
            minimum_order_amount,
            maximum_discount_amount,
            usage_limit,
            usage_count,
            starts_at,
            expires_at,
            is_active,
            created_at,
            updated_at
        FROM coupons
        WHERE id = $1
        `,
        [couponId]
    );

    if (result.rowCount === 0) {
        const error = new Error('Coupon not found');
        error.statusCode = 404;
        throw error;
    }

    return result.rows[0];
};

const createCoupon = async ({
    code,
    description,
    discount_type,
    discount_value,
    minimum_order_amount,
    maximum_discount_amount,
    usage_limit,
    starts_at,
    expires_at,
    is_active
}) => {
    const normalizedCode = normalizeCouponCode(code);

    const existingCoupon = await pool.query(
        `
        SELECT id
        FROM coupons
        WHERE code = $1
        `,
        [normalizedCode]
    );

    if (existingCoupon.rowCount > 0) {
        const error = new Error('A coupon with this code already exists');
        error.statusCode = 409;
        throw error;
    }

    const result = await pool.query(
        `
        INSERT INTO coupons (
            code,
            description,
            discount_type,
            discount_value,
            minimum_order_amount,
            maximum_discount_amount,
            usage_limit,
            starts_at,
            expires_at,
            is_active
        )
        VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10
        )
        RETURNING
            id,
            code,
            description,
            discount_type,
            discount_value,
            minimum_order_amount,
            maximum_discount_amount,
            usage_limit,
            usage_count,
            starts_at,
            expires_at,
            is_active,
            created_at,
            updated_at
        `,
        [
            normalizedCode,
            description || null,
            discount_type,
            discount_value,
            minimum_order_amount ?? 0,
            maximum_discount_amount ?? null,
            usage_limit ?? null,
            starts_at || new Date(),
            expires_at || null,
            is_active ?? true
        ]
    );

    return result.rows[0];
};

const updateCoupon = async (couponId, data) => {
    const coupon = await getCouponById(couponId);

    const updatedCode =
        data.code !== undefined
            ? normalizeCouponCode(data.code)
            : coupon.code;

    const updatedDescription =
        data.description !== undefined
            ? data.description
            : coupon.description;

    const updatedDiscountType =
        data.discount_type !== undefined
            ? data.discount_type
            : coupon.discount_type;

    const updatedDiscountValue =
        data.discount_value !== undefined
            ? data.discount_value
            : coupon.discount_value;

    const updatedMinimumOrderAmount =
        data.minimum_order_amount !== undefined
            ? data.minimum_order_amount
            : coupon.minimum_order_amount;

    const updatedMaximumDiscountAmount =
        data.maximum_discount_amount !== undefined
            ? data.maximum_discount_amount
            : coupon.maximum_discount_amount;

    const updatedUsageLimit =
        data.usage_limit !== undefined
            ? data.usage_limit
            : coupon.usage_limit;

    const updatedStartsAt =
        data.starts_at !== undefined
            ? data.starts_at
            : coupon.starts_at;

    const updatedExpiresAt =
        data.expires_at !== undefined
            ? data.expires_at
            : coupon.expires_at;

    const updatedIsActive =
        data.is_active !== undefined
            ? data.is_active
            : coupon.is_active;

    const duplicate = await pool.query(
        `
        SELECT id
        FROM coupons
        WHERE code = $1
          AND id <> $2
        `,
        [updatedCode, couponId]
    );

    if (duplicate.rowCount > 0) {
        const error = new Error('Another coupon with this code already exists');
        error.statusCode = 409;
        throw error;
    }

    const result = await pool.query(
        `
        UPDATE coupons
        SET
            code = $1,
            description = $2,
            discount_type = $3,
            discount_value = $4,
            minimum_order_amount = $5,
            maximum_discount_amount = $6,
            usage_limit = $7,
            starts_at = $8,
            expires_at = $9,
            is_active = $10,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $11
        RETURNING
            id,
            code,
            description,
            discount_type,
            discount_value,
            minimum_order_amount,
            maximum_discount_amount,
            usage_limit,
            usage_count,
            starts_at,
            expires_at,
            is_active,
            created_at,
            updated_at
        `,
        [
            updatedCode,
            updatedDescription,
            updatedDiscountType,
            updatedDiscountValue,
            updatedMinimumOrderAmount,
            updatedMaximumDiscountAmount,
            updatedUsageLimit,
            updatedStartsAt,
            updatedExpiresAt,
            updatedIsActive,
            couponId
        ]
    );

    return result.rows[0];
};

const deleteCoupon = async (couponId) => {
    const coupon = await getCouponById(couponId);

    if (coupon.usage_count > 0) {
        const error = new Error(
            'Coupon cannot be deleted because it has already been used. Deactivate it instead.'
        );
        error.statusCode = 409;
        throw error;
    }

    await pool.query(
        `DELETE FROM coupons WHERE id = $1`,
        [couponId]
    );

    return {
        id: Number(couponId),
        deleted: true
    };
};

module.exports = {
    getAllCoupons,
    getCouponById,
    createCoupon,
    updateCoupon,
    deleteCoupon
};