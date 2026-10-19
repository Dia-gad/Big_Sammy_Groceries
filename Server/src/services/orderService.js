const pool = require('../config/database');

const {
    reserveStock
} = require('./inventoryReservationService');


// =========================================================
// Generate a unique order number
// =========================================================

const generateOrderNumber = () => {
    const timestamp = Date.now();
    const random = Math.floor(1000 + Math.random() * 9000);

    return `BS-${timestamp}-${random}`;
};


// =========================================================
// Normalize coupon code
// =========================================================

const normalizeCouponCode = (code) => {
    if (!code) {
        return null;
    }

    return code.trim().toUpperCase();
};


// =========================================================
// Create an order from the customer's cart
// =========================================================

const createOrder = async (
    userId,
    {
        fulfillment_method,
        address_id,
        delivery_scheduled_at,
        coupon_code,
        notes
    }
) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');


        // =================================================
        // 1. Validate fulfillment method
        // =================================================

        if (!['delivery', 'pickup'].includes(fulfillment_method)) {
            const error = new Error(
                'Fulfillment method must be delivery or pickup'
            );

            error.statusCode = 400;

            throw error;
        }


        // =================================================
        // 2. Validate delivery time
        // =================================================

        let deliveryScheduledAt = null;

        if (fulfillment_method === 'delivery') {

            if (!delivery_scheduled_at) {
                const error = new Error(
                    'Delivery time is required for delivery orders'
                );

                error.statusCode = 400;

                throw error;
            }

            const requestedDeliveryTime =
                new Date(delivery_scheduled_at);

            if (Number.isNaN(requestedDeliveryTime.getTime())) {
                const error = new Error(
                    'Delivery time must be a valid date and time'
                );

                error.statusCode = 400;

                throw error;
            }

            const minimumDeliveryTime =
                new Date(Date.now() + 60 * 60 * 1000);

            if (requestedDeliveryTime < minimumDeliveryTime) {
                const error = new Error(
                    'Delivery time must be at least 1 hour after placing the order'
                );

                error.statusCode = 400;

                throw error;
            }

            deliveryScheduledAt = requestedDeliveryTime;
        }


        // =================================================
        // 3. Find customer's cart
        // =================================================

        const cartResult = await client.query(
            `
                SELECT id
                FROM carts
                WHERE user_id = $1
                FOR UPDATE
            `,
            [userId]
        );

        if (cartResult.rows.length === 0) {
            const error = new Error('Your cart is empty');

            error.statusCode = 400;

            throw error;
        }

        const cartId = cartResult.rows[0].id;


        // =================================================
        // 4. Get cart items using product variants
        // =================================================

        const cartItemsResult = await client.query(
            `
                SELECT
                    ci.id AS cart_item_id,
                    ci.variant_id,
                    ci.quantity,

                    pv.product_id,
                    pv.price,
                    pv.stock_quantity,
                    pv.is_available,
                    pv.sku,
                    pv.options,

                    p.name,
                    p.slug,

                    pu.name AS unit,
                    pu.abbreviation AS unit_abbreviation

                FROM cart_items ci

                INNER JOIN product_variants pv
                    ON ci.variant_id = pv.id

                INNER JOIN products p
                    ON pv.product_id = p.id

                INNER JOIN product_units pu
                    ON pv.unit_id = pu.id

                WHERE ci.cart_id = $1

                ORDER BY ci.id ASC

                FOR UPDATE
            `,
            [cartId]
        );

        const cartItems = cartItemsResult.rows;


        // =================================================
        // 5. Make sure cart contains items
        // =================================================

        if (cartItems.length === 0) {
            const error = new Error('Your cart is empty');

            error.statusCode = 400;

            throw error;
        }


        // =================================================
        // 6. Validate product availability and stock
        // =================================================

        for (const item of cartItems) {

            if (!item.is_available) {
                const error = new Error(
                    `${item.name} (${item.unit}) is currently unavailable`
                );

                error.statusCode = 400;

                throw error;
            }


            if (item.stock_quantity <= 0) {
                const error = new Error(
                    `${item.name} (${item.unit}) is out of stock`
                );

                error.statusCode = 400;

                throw error;
            }


            if (item.quantity > item.stock_quantity) {
                const error = new Error(
                    `Only ${item.stock_quantity} ${item.unit}(s) of ${item.name} are available`
                );

                error.statusCode = 400;

                throw error;
            }
        }


        // =================================================
        // 7. Calculate subtotal
        // =================================================

        const subtotal = cartItems.reduce(
            (sum, item) =>
                sum + Number(item.price) * item.quantity,
            0
        );


        // =================================================
        // 8. Validate delivery address
        // =================================================

        if (fulfillment_method === 'delivery') {

            if (!address_id) {
                const error = new Error(
                    'Delivery address is required for delivery orders'
                );

                error.statusCode = 400;

                throw error;
            }


            const addressResult = await client.query(
                `
                    SELECT id
                    FROM customer_addresses
                    WHERE id = $1
                      AND user_id = $2
                `,
                [address_id, userId]
            );


            if (addressResult.rows.length === 0) {
                const error = new Error(
                    'Delivery address not found'
                );

                error.statusCode = 404;

                throw error;
            }
        }


        // =================================================
        // 9. Minimum delivery order amount
        // =================================================

        const minimumDeliveryOrderAmount = 5000;


        if (
            fulfillment_method === 'delivery' &&
            subtotal < minimumDeliveryOrderAmount
        ) {
            const error = new Error(
                `Delivery is available only for orders of ₦${minimumDeliveryOrderAmount.toLocaleString()} or more. Please choose pickup instead.`
            );

            error.statusCode = 400;

            throw error;
        }


        // =================================================
        // 10. Calculate delivery fee
        // =================================================

        // Delivery fee can be replaced with a real
        // location-based calculation later.

        const deliveryFee = 0;


        // =================================================
        // 11. Validate and calculate coupon
        // =================================================

        let couponId = null;
        let couponCode = null;
        let discountAmount = 0;

        const normalizedCouponCode =
            normalizeCouponCode(coupon_code);


        if (normalizedCouponCode) {

            // ---------------------------------------------
            // Lock coupon row so simultaneous orders
            // cannot exceed the usage limit.
            // ---------------------------------------------

            const couponResult = await client.query(
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
                        is_active

                    FROM coupons

                    WHERE code = $1

                    FOR UPDATE
                `,
                [normalizedCouponCode]
            );


            if (couponResult.rows.length === 0) {
                const error = new Error(
                    'Invalid coupon code'
                );

                error.statusCode = 400;

                throw error;
            }


            const coupon = couponResult.rows[0];


            // ---------------------------------------------
            // Check active status
            // ---------------------------------------------

            if (!coupon.is_active) {
                const error = new Error(
                    'This coupon is no longer active'
                );

                error.statusCode = 400;

                throw error;
            }


            // ---------------------------------------------
            // Check start date
            // ---------------------------------------------

            if (
                coupon.starts_at &&
                new Date(coupon.starts_at) > new Date()
            ) {
                const error = new Error(
                    'This coupon is not active yet'
                );

                error.statusCode = 400;

                throw error;
            }


            // ---------------------------------------------
            // Check expiry
            // ---------------------------------------------

            if (
                coupon.expires_at &&
                new Date(coupon.expires_at) <= new Date()
            ) {
                const error = new Error(
                    'This coupon has expired'
                );

                error.statusCode = 400;

                throw error;
            }


            // ---------------------------------------------
            // Check usage limit
            // ---------------------------------------------

            if (
                coupon.usage_limit !== null &&
                coupon.usage_count >= coupon.usage_limit
            ) {
                const error = new Error(
                    'This coupon has reached its usage limit'
                );

                error.statusCode = 400;

                throw error;
            }


            // ---------------------------------------------
            // Check minimum order amount
            // ---------------------------------------------

            if (
                subtotal <
                Number(coupon.minimum_order_amount)
            ) {
                const error = new Error(
                    `This coupon requires a minimum order of ₦${Number(
                        coupon.minimum_order_amount
                    ).toLocaleString()}`
                );

                error.statusCode = 400;

                throw error;
            }


            // ---------------------------------------------
            // Calculate discount
            // ---------------------------------------------

            if (coupon.discount_type === 'percentage') {

                discountAmount =
                    subtotal *
                    (Number(coupon.discount_value) / 100);


                // Apply maximum discount cap
                if (
                    coupon.maximum_discount_amount !== null &&
                    discountAmount >
                    Number(coupon.maximum_discount_amount)
                ) {
                    discountAmount =
                        Number(coupon.maximum_discount_amount);
                }

            } else if (coupon.discount_type === 'fixed') {

                discountAmount =
                    Number(coupon.discount_value);
            }


            // ---------------------------------------------
            // Discount can never exceed subtotal
            // ---------------------------------------------

            if (discountAmount > subtotal) {
                discountAmount = subtotal;
            }


            // ---------------------------------------------
            // Round discount to two decimal places
            // ---------------------------------------------

            discountAmount =
                Math.round(
                    discountAmount * 100
                ) / 100;


            couponId = coupon.id;
            couponCode = coupon.code;
        }


        // =================================================
        // 12. Calculate final order total
        // =================================================

        const totalAmount =
            Math.max(
                0,
                subtotal +
                deliveryFee -
                discountAmount
            );


        // =================================================
        // 13. Generate order number
        // =================================================

        const orderNumber = generateOrderNumber();


        // =================================================
        // 14. Create order
        // =================================================

        const orderResult = await client.query(
            `
                INSERT INTO orders (
                    user_id,
                    order_number,
                    status,
                    fulfillment_method,
                    address_id,
                    delivery_scheduled_at,
                    delivery_fee,
                    subtotal,
                    total_amount,
                    payment_status,
                    coupon_id,
                    coupon_code,
                    discount_amount,
                    notes
                )

                VALUES (
                    $1,
                    $2,
                    'pending',
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    'pending',
                    $9,
                    $10,
                    $11,
                    $12
                )

                RETURNING
                    id,
                    user_id,
                    order_number,
                    status,
                    fulfillment_method,
                    address_id,
                    delivery_scheduled_at,
                    delivery_fee,
                    subtotal,
                    total_amount,
                    payment_status,
                    coupon_id,
                    coupon_code,
                    discount_amount,
                    notes,
                    created_at,
                    updated_at
            `,
            [
                userId,
                orderNumber,
                fulfillment_method,

                fulfillment_method === 'delivery'
                    ? address_id
                    : null,

                deliveryScheduledAt,

                deliveryFee,
                subtotal,
                totalAmount,

                couponId,
                couponCode,
                discountAmount,

                notes || null
            ]
        );


        const order = orderResult.rows[0];


        // =================================================
        // 15. Create order item snapshots
        // =================================================

        const orderItems = [];


        for (const item of cartItems) {

            const itemSubtotal =
                Number(item.price) *
                item.quantity;


            const orderItemResult = await client.query(
                `
                    INSERT INTO order_items (
                        order_id,
                        product_id,
                        variant_id,
                        product_name,
                        quantity,
                        unit_price,
                        subtotal
                    )

                    VALUES (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7
                    )

                    RETURNING *
                `,
                [
                    order.id,
                    item.product_id,
                    item.variant_id,
                    item.name,
                    item.quantity,
                    item.price,
                    itemSubtotal
                ]
            );


            orderItems.push(
                orderItemResult.rows[0]
            );
        }


        // =================================================
        // 16. Reserve inventory
        // =================================================
        //
        // This does NOT create a sale movement.
        //
        // Inventory is temporarily reserved for this
        // unpaid order.
        // =================================================

        const reservationExpiresAt =
            new Date(
                Date.now() + 30 * 60 * 1000
            );


        await reserveStock({
            orderId: order.id,

            items: cartItems.map((item) => ({
                variantId: item.variant_id,
                quantity: item.quantity
            })),

            expiresAt: reservationExpiresAt,

            client
        });


        // =================================================
        // 17. Record coupon usage
        // =================================================

        if (couponId) {

            await client.query(
                `
                    INSERT INTO coupon_usages (
                        coupon_id,
                        user_id,
                        order_id,
                        discount_amount
                    )

                    VALUES (
                        $1,
                        $2,
                        $3,
                        $4
                    )
                `,
                [
                    couponId,
                    userId,
                    order.id,
                    discountAmount
                ]
            );


            // ---------------------------------------------
            // Increment coupon usage counter
            // ---------------------------------------------

            await client.query(
                `
                    UPDATE coupons

                    SET
                        usage_count = usage_count + 1,
                        updated_at = CURRENT_TIMESTAMP

                    WHERE id = $1
                `,
                [couponId]
            );
        }


        // =================================================
        // 18. Clear customer's cart
        // =================================================

        await client.query(
            `
                DELETE FROM cart_items
                WHERE cart_id = $1
            `,
            [cartId]
        );


        // =================================================
        // 19. Commit transaction
        // =================================================

        await client.query('COMMIT');


        // =================================================
        // 20. Return order response
        // =================================================

        return {

            order,

            reservation: {
                expiresAt: reservationExpiresAt
            },

            items: cartItems.map((item) => ({

                product_id: item.product_id,

                variant_id: item.variant_id,

                product_name: item.name,

                unit: item.unit,

                unit_abbreviation:
                    item.unit_abbreviation,

                sku: item.sku,

                options: item.options,

                quantity: item.quantity,

                unit_price: item.price,

                subtotal:
                    Number(item.price) *
                    item.quantity
            })),

            pricing: {
                subtotal,
                delivery_fee: deliveryFee,
                discount_amount: discountAmount,
                total_amount: totalAmount,

                coupon: couponId
                    ? {
                        id: couponId,
                        code: couponCode,
                        discount_amount:
                            discountAmount
                    }
                    : null
            }
        };


    } catch (error) {

        // =================================================
        // Roll back EVERYTHING
        // =================================================
        //
        // Order
        // Order items
        // Inventory reservations
        // Coupon usage
        // Coupon usage counter
        // Cart changes
        //
        // Nothing should partially remain.
        // =================================================

        await client.query('ROLLBACK');

        throw error;

    } finally {

        client.release();
    }
};


// =========================================================
// Get all orders belonging to the customer
// =========================================================

const getMyOrders = async (userId) => {

    const result = await pool.query(
        `
            SELECT
                id,
                order_number,
                status,
                fulfillment_method,
                address_id,
                delivery_scheduled_at,
                delivery_fee,
                subtotal,
                coupon_id,
                coupon_code,
                discount_amount,
                total_amount,
                payment_status,
                notes,
                created_at,
                updated_at

            FROM orders

            WHERE user_id = $1

            ORDER BY created_at DESC
        `,
        [userId]
    );


    return result.rows;
};


// =========================================================
// Get one order belonging to the customer
// =========================================================

const getMyOrderById = async (
    userId,
    orderId
) => {

    const orderResult = await pool.query(
        `
            SELECT
                o.id,
                o.order_number,
                o.status,
                o.fulfillment_method,
                o.address_id,
                o.delivery_scheduled_at,
                o.delivery_fee,
                o.subtotal,
                o.coupon_id,
                o.coupon_code,
                o.discount_amount,
                o.total_amount,
                o.payment_status,
                o.notes,
                o.created_at,
                o.updated_at,

                a.label AS address_label,
                a.recipient_name,
                a.phone AS address_phone,
                a.address_line,
                a.city,
                a.state,
                a.landmark

            FROM orders o

            LEFT JOIN customer_addresses a
                ON o.address_id = a.id

            WHERE o.id = $1
              AND o.user_id = $2
        `,
        [orderId, userId]
    );


    if (orderResult.rows.length === 0) {

        const error = new Error(
            'Order not found'
        );

        error.statusCode = 404;

        throw error;
    }


    const order = orderResult.rows[0];


    // =====================================================
    // Get order items
    // =====================================================

    const itemsResult = await pool.query(
        `
            SELECT
                oi.id,
                oi.product_id,
                oi.variant_id,
                oi.product_name,
                oi.quantity,
                oi.unit_price,
                oi.subtotal,
                oi.created_at,

                pv.sku,
                pv.options,

                pu.name AS unit,
                pu.abbreviation AS unit_abbreviation

            FROM order_items oi

            LEFT JOIN product_variants pv
                ON pv.id = oi.variant_id

            LEFT JOIN product_units pu
                ON pu.id = pv.unit_id

            WHERE oi.order_id = $1

            ORDER BY oi.id ASC
        `,
        [orderId]
    );


    return {

        order,

        items: itemsResult.rows
    };
};


// =========================================================
// Get order status
// =========================================================

const getOrderStatus = async (
    userId,
    orderId
) => {

    const result = await pool.query(
        `
            SELECT
                id,
                order_number,
                status,
                fulfillment_method,
                delivery_scheduled_at,
                payment_status,
                subtotal,
                delivery_fee,
                coupon_id,
                coupon_code,
                discount_amount,
                total_amount,
                created_at,
                updated_at

            FROM orders

            WHERE id = $1
              AND user_id = $2
        `,
        [orderId, userId]
    );


    if (result.rows.length === 0) {

        const error = new Error(
            'Order not found'
        );

        error.statusCode = 404;

        throw error;
    }


    return result.rows[0];
};


// =========================================================
// Exports
// =========================================================

module.exports = {
    createOrder,
    getMyOrders,
    getMyOrderById,
    getOrderStatus
};