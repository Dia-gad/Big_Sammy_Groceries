const crypto = require('crypto');
const pool = require('../config/database');

const initializePayment = async (userId, orderId) => {
    const orderResult = await pool.query(
        `SELECT
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
           AND o.user_id = $2`,
        [orderId, userId]
    );

    if (orderResult.rows.length === 0) {
        const error = new Error('Order not found');
        error.statusCode = 404;
        throw error;
    }

    const order = orderResult.rows[0];

    if (order.payment_status === 'paid') {
        const error = new Error('This order has already been paid for');
        error.statusCode = 400;
        throw error;
    }

    if (order.status === 'cancelled') {
        const error = new Error('Cannot pay for a cancelled order');
        error.statusCode = 400;
        throw error;
    }

    const reference = `BS-${order.id}-${Date.now()}-${crypto
        .randomBytes(4)
        .toString('hex')}`;

    const amountInKobo = Math.round(Number(order.total_amount) * 100);

    if (amountInKobo <= 0) {
        const error = new Error('Invalid order amount');
        error.statusCode = 400;
        throw error;
    }

    const paystackResponse = await fetch(
        'https://api.paystack.co/transaction/initialize',
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: order.email,
                amount: String(amountInKobo),
                currency: 'NGN',
                reference,
                callback_url: process.env.PAYSTACK_CALLBACK_URL,
                metadata: {
                    order_id: order.id,
                    order_number: order.order_number,
                    user_id: userId,
                    customer_name: `${order.first_name} ${order.last_name}`
                }
            })
        }
    );

    const paystackData = await paystackResponse.json();

    if (!paystackResponse.ok || !paystackData.status) {
        const error = new Error(
            paystackData.message || 'Unable to initialize payment'
        );
        error.statusCode = 502;
        throw error;
    }

    const transaction = paystackData.data;

    const paymentResult = await pool.query(
        `INSERT INTO payments (
            order_id,
            user_id,
            provider,
            reference,
            gateway_transaction_id,
            amount,
            currency,
            status
        )
        VALUES ($1, $2, 'paystack', $3, $4, $5, 'NGN', 'pending')
        RETURNING
            id,
            order_id,
            provider,
            reference,
            amount,
            currency,
            status,
            created_at`,
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
        authorization_url: transaction.authorization_url,
        access_code: transaction.access_code
    };
};


/*
 * Verify a Paystack transaction
 */
const verifyPayment = async (userId, reference) => {
    const paymentResult = await pool.query(
        `SELECT
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
           AND p.user_id = $2`,
        [reference, userId]
    );

    if (paymentResult.rows.length === 0) {
        const error = new Error('Payment record not found');
        error.statusCode = 404;
        throw error;
    }

    const payment = paymentResult.rows[0];

    const paystackResponse = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
            }
        }
    );

    const paystackData = await paystackResponse.json();

    if (!paystackResponse.ok || !paystackData.status) {
        const error = new Error(
            paystackData.message || 'Unable to verify payment'
        );
        error.statusCode = 502;
        throw error;
    }

    const transaction = paystackData.data;

    /*
     * Security checks
     */

    if (transaction.reference !== payment.reference) {
        const error = new Error('Payment reference mismatch');
        error.statusCode = 400;
        throw error;
    }

    const expectedAmount = Math.round(Number(payment.amount) * 100);

    if (Number(transaction.amount) !== expectedAmount) {
        const error = new Error('Payment amount mismatch');
        error.statusCode = 400;
        throw error;
    }

    if (transaction.currency !== payment.currency) {
        const error = new Error('Payment currency mismatch');
        error.statusCode = 400;
        throw error;
    }

    /*
     * Payment was successful
     */
    if (transaction.status === 'success') {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const updatedPayment = await client.query(
                `UPDATE payments
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
                    paid_at`,
                [
                    transaction.id,
                    transaction.channel || null,
                    transaction.paid_at || null,
                    payment.id
                ]
            );

            await client.query(
                `UPDATE orders
                 SET
                    payment_status = 'paid',
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1
                   AND payment_status <> 'paid'`,
                [payment.order_id]
            );

            await client.query('COMMIT');

            return {
                payment: updatedPayment.rows[0] || {
                    id: payment.id,
                    order_id: payment.order_id,
                    reference: payment.reference,
                    amount: payment.amount,
                    currency: payment.currency,
                    status: 'success'
                },
                order_payment_status: 'paid'
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /*
     * Payment is not successful yet
     */
    await pool.query(
        `UPDATE payments
         SET
            status = $1,
            updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [transaction.status, payment.id]
    );

    return {
        payment: {
            id: payment.id,
            order_id: payment.order_id,
            reference: payment.reference,
            amount: payment.amount,
            currency: payment.currency,
            status: transaction.status
        },
        order_payment_status: payment.payment_status
    };
};

const handlePaystackWebhook = async (event) => {
    if (event.event !== 'charge.success') {
        return {
            processed: false,
            message: 'Event received but no payment action was required'
        };
    }

    const transaction = event.data;

    const paymentResult = await pool.query(
        `SELECT
            id,
            order_id,
            reference,
            amount,
            currency,
            status
         FROM payments
         WHERE reference = $1`,
        [transaction.reference]
    );

    if (paymentResult.rows.length === 0) {
        console.error(
            'Paystack webhook payment not found:',
            transaction.reference
        );

        return {
            processed: false,
            message: 'Payment record not found'
        };
    }

    const payment = paymentResult.rows[0];

    /*
     * Verify the amount sent by Paystack
     * against the amount stored in Big Sammy.
     */
    const expectedAmount = Math.round(
        Number(payment.amount) * 100
    );

    if (Number(transaction.amount) !== expectedAmount) {
        throw new Error('Webhook payment amount mismatch');
    }

    if (transaction.currency !== payment.currency) {
        throw new Error('Webhook payment currency mismatch');
    }

    /*
     * Idempotency:
     * If Paystack sends the same successful event again,
     * don't process the payment twice.
     */
    if (payment.status === 'success') {
        return {
            processed: true,
            message: 'Payment was already processed'
        };
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query(
            `UPDATE payments
             SET
                status = 'success',
                gateway_transaction_id = $1,
                channel = $2,
                paid_at = $3,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
               AND status <> 'success'`,
            [
                transaction.id,
                transaction.channel || null,
                transaction.paid_at || null,
                payment.id
            ]
        );

        await client.query(
            `UPDATE orders
             SET
                payment_status = 'paid',
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
               AND payment_status <> 'paid'`,
            [payment.order_id]
        );

        await client.query('COMMIT');

        return {
            processed: true,
            message: 'Payment processed successfully'
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

const verifyPaymentByReference = async (reference) => {
    const paymentResult = await pool.query(
        `SELECT
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
         WHERE p.reference = $1`,
        [reference]
    );

    if (paymentResult.rows.length === 0) {
        const error = new Error('Payment not found');
        error.statusCode = 404;
        throw error;
    }

    const payment = paymentResult.rows[0];

    const paystackResponse = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
            }
        }
    );

    const paystackData = await paystackResponse.json();

    if (!paystackResponse.ok || !paystackData.status) {
        const error = new Error(
            paystackData.message || 'Unable to verify payment'
        );
        error.statusCode = 502;
        throw error;
    }

    const transaction = paystackData.data;

    const expectedAmount = Math.round(
        Number(payment.amount) * 100
    );

    if (Number(transaction.amount) !== expectedAmount) {
        const error = new Error('Payment amount mismatch');
        error.statusCode = 400;
        throw error;
    }

    if (transaction.currency !== payment.currency) {
        const error = new Error('Payment currency mismatch');
        error.statusCode = 400;
        throw error;
    }

    if (transaction.status === 'success') {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            await client.query(
                `UPDATE payments
                 SET
                    status = 'success',
                    gateway_transaction_id = $1,
                    channel = $2,
                    paid_at = $3,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = $4
                   AND status <> 'success'`,
                [
                    transaction.id,
                    transaction.channel || null,
                    transaction.paid_at || null,
                    payment.id
                ]
            );

            await client.query(
                `UPDATE orders
                 SET
                    payment_status = 'paid',
                    status = CASE
                        WHEN status = 'pending'
                        THEN 'confirmed'
                        ELSE status
                    END,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1
                   AND payment_status <> 'paid'`,
                [payment.order_id]
            );

            await client.query('COMMIT');

            return {
                order_id: payment.order_id,
                order_number: payment.order_number,
                payment_status: 'paid',
                payment_status_from_gateway: transaction.status,
                amount: payment.amount,
                currency: payment.currency
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    return {
        order_id: payment.order_id,
        order_number: payment.order_number,
        payment_status: payment.payment_status,
        payment_status_from_gateway: transaction.status,
        amount: payment.amount,
        currency: payment.currency
    };
};

module.exports = {
    initializePayment,
    verifyPayment,
    verifyPaymentByReference,
    handlePaystackWebhook
};