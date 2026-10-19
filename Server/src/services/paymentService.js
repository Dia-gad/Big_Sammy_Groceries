const crypto = require('crypto');
const pool = require('../config/database');

const {
    recordMovement
} = require('./inventoryService');

const {
    reserveStock
} = require('./inventoryReservationService');


// =========================================================
// HELPERS
// =========================================================

const createPaymentReference = (orderId) => {
    return `BS-${orderId}-${Date.now()}-${crypto
        .randomBytes(4)
        .toString('hex')}`;
};

const getAmountInKobo = (amount) => {
    const amountInKobo = Math.round(Number(amount) * 100);

    if (!Number.isFinite(amountInKobo) || amountInKobo <= 0) {
        const error = new Error('Invalid order amount');
        error.statusCode = 400;
        throw error;
    }

    return amountInKobo;
};


// =========================================================
// INITIALIZE PAYSTACK PAYMENT
// =========================================================

const initializePayment = async (userId, orderId) => {
    const orderResult = await pool.query(
        `
        SELECT
            o.id,
            o.order_number,
            o.user_id,
            o.total_amount,
            o.payment_status,
            o.status,
            u.email,
            u.first_name,
            u.last_name
        FROM orders o
        INNER JOIN users u
            ON o.user_id = u.id
        WHERE o.id = $1
          AND o.user_id = $2
        `,
        [orderId, userId]
    );

    if (orderResult.rowCount === 0) {
        const error = new Error('Order not found');
        error.statusCode = 404;
        throw error;
    }

    const order = orderResult.rows[0];

    if (order.payment_status === 'paid') {
        const error = new Error(
            'This order has already been paid for'
        );

        error.statusCode = 400;
        throw error;
    }

    if (order.status === 'cancelled') {
        const error = new Error(
            'Cannot pay for a cancelled order'
        );

        error.statusCode = 400;
        throw error;
    }

    const reference = createPaymentReference(order.id);

    const amountInKobo =
        getAmountInKobo(order.total_amount);

    const paystackResponse = await fetch(
        'https://api.paystack.co/transaction/initialize',
        {
            method: 'POST',

            headers: {
                Authorization:
                    `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,

                'Content-Type': 'application/json'
            },

            body: JSON.stringify({
                email: order.email,
                amount: String(amountInKobo),
                currency: 'NGN',
                reference,

                callback_url:
                    process.env.PAYSTACK_CALLBACK_URL,

                metadata: {
                    order_id: order.id,
                    order_number: order.order_number,
                    user_id: userId,
                    customer_name:
                        `${order.first_name} ${order.last_name}`
                }
            })
        }
    );

    const paystackData =
        await paystackResponse.json();

    if (
        !paystackResponse.ok ||
        !paystackData.status
    ) {
        const error = new Error(
            paystackData.message ||
            'Unable to initialize payment'
        );

        error.statusCode = 502;
        throw error;
    }

    const transaction =
        paystackData.data;

    const paymentResult = await pool.query(
        `
        INSERT INTO payments (
            order_id,
            user_id,
            provider,
            reference,
            gateway_transaction_id,
            amount,
            currency,
            status
        )
        VALUES (
            $1,
            $2,
            'paystack',
            $3,
            $4,
            $5,
            'NGN',
            'pending'
        )
        RETURNING
            id,
            order_id,
            provider,
            reference,
            amount,
            currency,
            status,
            created_at
        `,
        [
            order.id,
            userId,
            transaction.reference,
            transaction.id || null,
            order.total_amount
        ]
    );

    return {
        payment: paymentResult.rows[0],

        authorization_url:
            transaction.authorization_url,

        access_code:
            transaction.access_code
    };
};


// =========================================================
// RETRY PAYSTACK PAYMENT
//
// A previous failed/abandoned payment may have released
// the inventory reservation.
//
// Before creating another payment attempt, we ensure that
// the order has an active reservation.
//
// IMPORTANT:
// The retry does NOT create duplicate reservations when
// an active reservation already exists.
// =========================================================

const retryPayment = async (userId, orderId) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // -----------------------------------------------------
        // 1. Lock the order
        // -----------------------------------------------------

        const orderResult = await client.query(
            `
            SELECT
                o.id,
                o.order_number,
                o.user_id,
                o.total_amount,
                o.payment_status,
                o.status,
                o.fulfillment_method,
                u.email,
                u.first_name,
                u.last_name
            FROM orders o
            INNER JOIN users u
                ON o.user_id = u.id
            WHERE o.id = $1
              AND o.user_id = $2
            FOR UPDATE
            `,
            [orderId, userId]
        );

        if (orderResult.rowCount === 0) {
            const error = new Error('Order not found');
            error.statusCode = 404;
            throw error;
        }

        const order = orderResult.rows[0];

        // -----------------------------------------------------
        // 2. Validate order state
        // -----------------------------------------------------

        if (order.payment_status === 'paid') {
            const error = new Error(
                'This order has already been paid for'
            );

            error.statusCode = 400;
            throw error;
        }

        if (order.status === 'cancelled') {
            const error = new Error(
                'Cannot retry payment for a cancelled order'
            );

            error.statusCode = 400;
            throw error;
        }

        // -----------------------------------------------------
        // 3. Prevent multiple active payment attempts
        // -----------------------------------------------------

        const activePaymentResult = await client.query(
            `
            SELECT
                id,
                reference,
                status
            FROM payments
            WHERE order_id = $1
              AND status = 'pending'
            ORDER BY id DESC
            LIMIT 1
            FOR UPDATE
            `,
            [order.id]
        );

        if (activePaymentResult.rowCount > 0) {
            const error = new Error(
                'This order already has a pending payment attempt'
            );

            error.statusCode = 409;
            throw error;
        }

        // -----------------------------------------------------
        // 4. Expire stale reservations
        // -----------------------------------------------------

        await client.query(
            `
            UPDATE inventory_reservations
            SET
                status = 'expired',
                updated_at = CURRENT_TIMESTAMP
            WHERE order_id = $1
              AND status = 'pending'
              AND expires_at <= CURRENT_TIMESTAMP
            `,
            [order.id]
        );

        // -----------------------------------------------------
        // 5. Check for an active reservation
        // -----------------------------------------------------

        const reservationResult = await client.query(
            `
            SELECT
                id,
                variant_id,
                order_id,
                quantity,
                status,
                expires_at
            FROM inventory_reservations
            WHERE order_id = $1
              AND status = 'pending'
              AND expires_at > CURRENT_TIMESTAMP
            ORDER BY id ASC
            FOR UPDATE
            `,
            [order.id]
        );

        let reservations = reservationResult.rows;

        // -----------------------------------------------------
        // 6. Recreate reservation if necessary
        // -----------------------------------------------------

        if (reservations.length === 0) {
            const orderItemsResult = await client.query(
                `
                SELECT
                    oi.id,
                    oi.variant_id,
                    oi.quantity
                FROM order_items oi
                WHERE oi.order_id = $1
                ORDER BY oi.id ASC
                `,
                [order.id]
            );

            if (orderItemsResult.rowCount === 0) {
                const error = new Error(
                    'No order items found for payment retry'
                );

                error.statusCode = 409;
                throw error;
            }

            const reservationItems =
                orderItemsResult.rows.map((item) => ({
                    variantId: item.variant_id,
                    quantity: item.quantity
                }));

            const expiresAt = new Date(
                Date.now() + 30 * 60 * 1000
            );

            /*
             * reserveStock() is responsible for:
             *
             * - locking product variants
             * - checking stock
             * - checking existing active reservations
             * - creating reservations
             *
             * We pass our existing transaction client so the
             * reservation and payment preparation remain part
             * of the same database transaction.
             */
            await reserveStock({
                orderId: order.id,
                items: reservationItems,
                expiresAt,
                client
            });

            // Reload the newly-created reservations.
            const newReservationResult =
                await client.query(
                    `
                    SELECT
                        id,
                        variant_id,
                        order_id,
                        quantity,
                        status,
                        expires_at
                    FROM inventory_reservations
                    WHERE order_id = $1
                      AND status = 'pending'
                    ORDER BY id ASC
                    FOR UPDATE
                    `,
                    [order.id]
                );

            reservations =
                newReservationResult.rows;
        }

        // -----------------------------------------------------
        // 7. Final reservation safety check
        // -----------------------------------------------------

        if (reservations.length === 0) {
            const error = new Error(
                'Unable to create inventory reservation for payment retry'
            );

            error.statusCode = 409;
            throw error;
        }

        // -----------------------------------------------------
        // 8. Initialize Paystack
        // -----------------------------------------------------

        const reference =
            createPaymentReference(order.id);

        const amountInKobo =
            getAmountInKobo(order.total_amount);

        const paystackResponse = await fetch(
            'https://api.paystack.co/transaction/initialize',
            {
                method: 'POST',

                headers: {
                    Authorization:
                        `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,

                    'Content-Type': 'application/json'
                },

                body: JSON.stringify({
                    email: order.email,
                    amount: String(amountInKobo),
                    currency: 'NGN',
                    reference,

                    callback_url:
                        process.env.PAYSTACK_CALLBACK_URL,

                    metadata: {
                        order_id: order.id,
                        order_number: order.order_number,
                        user_id: userId,
                        customer_name:
                            `${order.first_name} ${order.last_name}`
                    }
                })
            }
        );

        const paystackData =
            await paystackResponse.json();

        if (
            !paystackResponse.ok ||
            !paystackData.status
        ) {
            const error = new Error(
                paystackData.message ||
                'Unable to initialize payment retry'
            );

            error.statusCode = 502;
            throw error;
        }

        const transaction =
            paystackData.data;

        // -----------------------------------------------------
        // 9. Create new payment attempt
        // -----------------------------------------------------

        const paymentResult = await client.query(
            `
            INSERT INTO payments (
                order_id,
                user_id,
                provider,
                reference,
                gateway_transaction_id,
                amount,
                currency,
                status
            )
            VALUES (
                $1,
                $2,
                'paystack',
                $3,
                $4,
                $5,
                'NGN',
                'pending'
            )
            RETURNING
                id,
                order_id,
                provider,
                reference,
                amount,
                currency,
                status,
                created_at
            `,
            [
                order.id,
                userId,
                transaction.reference,
                transaction.id || null,
                order.total_amount
            ]
        );

        await client.query('COMMIT');

        return {
            payment: paymentResult.rows[0],

            authorization_url:
                transaction.authorization_url,

            access_code:
                transaction.access_code,

            reservation: {
                expiresAt:
                    reservations[0].expires_at
            }
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};


// =========================================================
// COMPLETE SUCCESSFUL PAYMENT + CONVERT INVENTORY
//
// This is the ONLY place where a pending reservation becomes
// an actual SALE.
//
// Everything happens inside one DB transaction.
// =========================================================

const completeSuccessfulPayment = async ({
    client,
    payment,
    transaction
}) => {

    // -----------------------------------------------------
    // 1. Lock payment record
    // -----------------------------------------------------

    const paymentLockResult = await client.query(
        `
        SELECT
            id,
            order_id,
            user_id,
            reference,
            amount,
            currency,
            status
        FROM payments
        WHERE id = $1
        FOR UPDATE
        `,
        [payment.id]
    );

    if (paymentLockResult.rowCount === 0) {
        const error = new Error(
            'Payment record not found'
        );

        error.statusCode = 404;
        throw error;
    }

    const lockedPayment =
        paymentLockResult.rows[0];

    // -----------------------------------------------------
    // 2. Idempotency
    // -----------------------------------------------------

    if (lockedPayment.status === 'success') {
        return {
            alreadyProcessed: true,
            payment: lockedPayment,
            saleMovements: []
        };
    }

    // -----------------------------------------------------
    // 3. Get pending reservations
    // -----------------------------------------------------

    const reservationResult =
        await client.query(
            `
            SELECT
                ir.id,
                ir.variant_id,
                ir.order_id,
                ir.quantity,
                ir.status,
                ir.expires_at
            FROM inventory_reservations ir
            WHERE ir.order_id = $1
              AND ir.status = 'pending'
            ORDER BY ir.id ASC
            FOR UPDATE
            `,
            [lockedPayment.order_id]
        );

    if (reservationResult.rowCount === 0) {
        const error = new Error(
            'No pending inventory reservation found for this order'
        );

        error.statusCode = 409;
        throw error;
    }

    // -----------------------------------------------------
    // 4. Reservation expiry check
    // -----------------------------------------------------

    for (
        const reservation
        of reservationResult.rows
    ) {
        if (
            new Date(reservation.expires_at)
            <= new Date()
        ) {
            const error = new Error(
                'Inventory reservation has expired'
            );

            error.statusCode = 409;
            throw error;
        }
    }

    // -----------------------------------------------------
    // 5. Record SALE movements
    // -----------------------------------------------------

    const saleMovements = [];

    for (
        const reservation
        of reservationResult.rows
    ) {

        const movement =
            await recordMovement({
                variantId:
                    reservation.variant_id,

                movementType:
                    'sale',

                quantity:
                    reservation.quantity,

                referenceType:
                    'order',

                referenceId:
                    reservation.order_id,

                reason:
                    'Paid order inventory sale',

                createdBy:
                    lockedPayment.user_id,

                client
            });

        saleMovements.push(
            movement.movement
        );

        // -------------------------------------------------
        // 6. Convert reservation AFTER sale succeeds
        // -------------------------------------------------

        await client.query(
            `
            UPDATE inventory_reservations
            SET
                status = 'converted',
                converted_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
              AND status = 'pending'
            `,
            [reservation.id]
        );
    }

    // -----------------------------------------------------
    // 7. Mark payment successful
    // -----------------------------------------------------

    const updatedPaymentResult =
        await client.query(
            `
            UPDATE payments
            SET
                status = 'success',
                gateway_transaction_id = $1,
                channel = $2,
                paid_at = $3,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
              AND status <> 'success'
            RETURNING
                id,
                order_id,
                reference,
                amount,
                currency,
                status,
                channel,
                paid_at
            `,
            [
                transaction.id,
                transaction.channel || null,
                transaction.paid_at || null,
                lockedPayment.id
            ]
        );

    // -----------------------------------------------------
    // 8. Mark order paid and confirmed
    // -----------------------------------------------------

    await client.query(
        `
        UPDATE orders
        SET
            payment_status = 'paid',

            status = CASE
                WHEN status = 'pending'
                THEN 'confirmed'
                ELSE status
            END,

            updated_at = CURRENT_TIMESTAMP

        WHERE id = $1
        `,
        [lockedPayment.order_id]
    );

    return {
        alreadyProcessed: false,

        payment:
            updatedPaymentResult.rows[0],

        saleMovements
    };
};


// =========================================================
// VERIFY PAYSTACK TRANSACTION
// =========================================================

const verifyPayment = async (
    userId,
    reference
) => {

    const paymentResult = await pool.query(
        `
        SELECT
            p.id,
            p.order_id,
            p.user_id,
            p.reference,
            p.amount,
            p.currency,
            p.status,
            o.total_amount,
            o.payment_status
        FROM payments p
        INNER JOIN orders o
            ON p.order_id = o.id
        WHERE p.reference = $1
          AND p.user_id = $2
        `,
        [reference, userId]
    );

    if (paymentResult.rowCount === 0) {
        const error = new Error(
            'Payment record not found'
        );

        error.statusCode = 404;
        throw error;
    }

    const payment =
        paymentResult.rows[0];

    const paystackResponse = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        {
            method: 'GET',

            headers: {
                Authorization:
                    `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
            }
        }
    );

    const paystackData =
        await paystackResponse.json();

    if (
        !paystackResponse.ok ||
        !paystackData.status
    ) {
        const error = new Error(
            paystackData.message ||
            'Unable to verify payment'
        );

        error.statusCode = 502;
        throw error;
    }

    const transaction =
        paystackData.data;

    // -----------------------------------------------------
    // Security: reference
    // -----------------------------------------------------

    if (
        transaction.reference !==
        payment.reference
    ) {
        const error = new Error(
            'Payment reference mismatch'
        );

        error.statusCode = 400;
        throw error;
    }

    // -----------------------------------------------------
    // Security: amount
    // -----------------------------------------------------

    const expectedAmount =
        Math.round(
            Number(payment.amount) * 100
        );

    if (
        Number(transaction.amount) !==
        expectedAmount
    ) {
        const error = new Error(
            'Payment amount mismatch'
        );

        error.statusCode = 400;
        throw error;
    }

    // -----------------------------------------------------
    // Security: currency
    // -----------------------------------------------------

    if (
        transaction.currency !==
        payment.currency
    ) {
        const error = new Error(
            'Payment currency mismatch'
        );

        error.statusCode = 400;
        throw error;
    }

    // -----------------------------------------------------
    // Successful payment
    // -----------------------------------------------------

    if (
        transaction.status === 'success'
    ) {

        const client =
            await pool.connect();

        try {
            await client.query('BEGIN');

            const result =
                await completeSuccessfulPayment({
                    client,
                    payment,
                    transaction
                });

            await client.query('COMMIT');

            return {
                payment:
                    result.payment,

                order_payment_status:
                    'paid',

                inventory:
                    result.saleMovements || []
            };

        } catch (error) {

            await client.query(
                'ROLLBACK'
            );

            throw error;

        } finally {
            client.release();
        }
    }

    // -----------------------------------------------------
    // Failed / abandoned payment
    // -----------------------------------------------------

    await pool.query(
        `
        UPDATE payments
        SET
            status = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        `,
        [
            transaction.status,
            payment.id
        ]
    );

    // -----------------------------------------------------
    // Release reservation
    // -----------------------------------------------------

    if (
        ['failed', 'abandoned']
            .includes(transaction.status)
    ) {

        const client =
            await pool.connect();

        try {

            await client.query('BEGIN');

            await client.query(
                `
                UPDATE inventory_reservations
                SET
                    status = 'released',
                    released_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE order_id = $1
                  AND status = 'pending'
                `,
                [payment.order_id]
            );

            await client.query(
                `
                UPDATE orders
                SET
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = $1
                `,
                [payment.order_id]
            );

            await client.query(
                'COMMIT'
            );

        } catch (error) {

            await client.query(
                'ROLLBACK'
            );

            throw error;

        } finally {
            client.release();
        }
    }

    return {
        payment: {
            id: payment.id,
            order_id: payment.order_id,
            reference: payment.reference,
            amount: payment.amount,
            currency: payment.currency,
            status: transaction.status
        },

        order_payment_status:
            payment.payment_status
    };
};


// =========================================================
// PAYSTACK WEBHOOK
// =========================================================

const handlePaystackWebhook = async (
    event
) => {

    // Only successful charges affect inventory/payment.
    if (
        event.event !==
        'charge.success'
    ) {
        return {
            processed: false,
            message:
                'Event received but no payment action was required'
        };
    }

    const transaction =
        event.data;

    const paymentResult =
        await pool.query(
            `
            SELECT
                id,
                order_id,
                user_id,
                reference,
                amount,
                currency,
                status
            FROM payments
            WHERE reference = $1
            `,
            [transaction.reference]
        );

    if (
        paymentResult.rowCount === 0
    ) {

        console.error(
            'Paystack webhook payment not found:',
            transaction.reference
        );

        return {
            processed: false,
            message:
                'Payment record not found'
        };
    }

    const payment =
        paymentResult.rows[0];

    // -----------------------------------------------------
    // Security: amount
    // -----------------------------------------------------

    const expectedAmount =
        Math.round(
            Number(payment.amount) * 100
        );

    if (
        Number(transaction.amount) !==
        expectedAmount
    ) {
        throw new Error(
            'Webhook payment amount mismatch'
        );
    }

    // -----------------------------------------------------
    // Security: currency
    // -----------------------------------------------------

    if (
        transaction.currency !==
        payment.currency
    ) {
        throw new Error(
            'Webhook payment currency mismatch'
        );
    }

    // -----------------------------------------------------
    // Idempotency
    // -----------------------------------------------------

    if (
        payment.status === 'success'
    ) {
        return {
            processed: true,
            message:
                'Payment was already processed'
        };
    }

    const client =
        await pool.connect();

    try {

        await client.query(
            'BEGIN'
        );

        const result =
            await completeSuccessfulPayment({
                client,
                payment,
                transaction
            });

        await client.query(
            'COMMIT'
        );

        return {
            processed: true,

            message:
                result.alreadyProcessed
                    ? 'Payment was already processed'
                    : 'Payment processed successfully',

            inventory:
                result.saleMovements || []
        };

    } catch (error) {

        await client.query(
            'ROLLBACK'
        );

        throw error;

    } finally {
        client.release();
    }
};


// =========================================================
// VERIFY PAYMENT BY REFERENCE
// Used by Paystack callback
// =========================================================

const verifyPaymentByReference = async (
    reference
) => {

    const paymentResult =
        await pool.query(
            `
            SELECT
                p.id,
                p.order_id,
                p.user_id,
                p.reference,
                p.amount,
                p.currency,
                p.status,

                o.order_number,
                o.payment_status

            FROM payments p

            INNER JOIN orders o
                ON p.order_id = o.id

            WHERE p.reference = $1
            `,
            [reference]
        );

    if (
        paymentResult.rowCount === 0
    ) {
        const error = new Error(
            'Payment not found'
        );

        error.statusCode = 404;
        throw error;
    }

    const payment =
        paymentResult.rows[0];

    const paystackResponse =
        await fetch(
            `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
            {
                method: 'GET',

                headers: {
                    Authorization:
                        `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
                }
            }
        );

    const paystackData =
        await paystackResponse.json();

    if (
        !paystackResponse.ok ||
        !paystackData.status
    ) {
        const error = new Error(
            paystackData.message ||
            'Unable to verify payment'
        );

        error.statusCode = 502;
        throw error;
    }

    const transaction =
        paystackData.data;

    // -----------------------------------------------------
    // Security: amount
    // -----------------------------------------------------

    const expectedAmount =
        Math.round(
            Number(payment.amount) * 100
        );

    if (
        Number(transaction.amount) !==
        expectedAmount
    ) {
        const error = new Error(
            'Payment amount mismatch'
        );

        error.statusCode = 400;
        throw error;
    }

    // -----------------------------------------------------
    // Security: currency
    // -----------------------------------------------------

    if (
        transaction.currency !==
        payment.currency
    ) {
        const error = new Error(
            'Payment currency mismatch'
        );

        error.statusCode = 400;
        throw error;
    }

    // -----------------------------------------------------
    // Successful payment
    // -----------------------------------------------------

    if (
        transaction.status === 'success'
    ) {

        const client =
            await pool.connect();

        try {

            await client.query(
                'BEGIN'
            );

            const result =
                await completeSuccessfulPayment({
                    client,
                    payment,
                    transaction
                });

            await client.query(
                'COMMIT'
            );

            return {
                order_id:
                    payment.order_id,

                order_number:
                    payment.order_number,

                payment_status:
                    'paid',

                payment_status_from_gateway:
                    transaction.status,

                amount:
                    payment.amount,

                currency:
                    payment.currency,

                inventory:
                    result.saleMovements || []
            };

        } catch (error) {

            await client.query(
                'ROLLBACK'
            );

            throw error;

        } finally {
            client.release();
        }
    }

    // -----------------------------------------------------
    // Payment not successful
    // -----------------------------------------------------

    return {
        order_id:
            payment.order_id,

        order_number:
            payment.order_number,

        payment_status:
            payment.payment_status,

        payment_status_from_gateway:
            transaction.status,

        amount:
            payment.amount,

        currency:
            payment.currency
    };
};


// =========================================================
// EXPORTS
// =========================================================

module.exports = {
    initializePayment,
    retryPayment,
    verifyPayment,
    verifyPaymentByReference,
    handlePaystackWebhook
};