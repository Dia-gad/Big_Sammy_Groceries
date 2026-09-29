const crypto = require('crypto');

const {
    initializePayment,
    verifyPayment,
    verifyPaymentByReference,
    handlePaystackWebhook
} = require('../services/paymentService');

const verifyCallback = async (req, res, next) => {
    try {
        const { reference } = req.query;

        if (!reference) {
            return res.status(400).json({
                success: false,
                message: 'Payment reference is required'
            });
        }

        const result = await verifyPaymentByReference(reference);

        res.status(200).json({
            success: true,
            message: 'Payment callback verified successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

const initialize = async (req, res, next) => {
    try {
        const { orderId } = req.body;

        const result = await initializePayment(
            req.user.userId,
            orderId
        );

        res.status(201).json({
            success: true,
            message: 'Payment initialized successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
};


const verify = async (req, res, next) => {
    try {
        const { reference } = req.params;

        const result = await verifyPayment(
            req.user.userId,
            reference
        );

        res.status(200).json({
            success: true,
            message: 'Payment verification completed',
            data: result
        });
    } catch (error) {
        next(error);
    }
};


const webhook = async (req, res, next) => {
    try {
        const signature = req.headers['x-paystack-signature'];

        if (!signature) {
            return res.status(401).json({
                success: false,
                message: 'Missing Paystack signature'
            });
        }

        const hash = crypto
            .createHmac(
                'sha512',
                process.env.PAYSTACK_SECRET_KEY
            )
            .update(req.rawBody)
            .digest('hex');

        const signatureBuffer = Buffer.from(signature, 'hex');
        const hashBuffer = Buffer.from(hash, 'hex');

        if (
            signatureBuffer.length !== hashBuffer.length ||
            !crypto.timingSafeEqual(
                signatureBuffer,
                hashBuffer
            )
        ) {
            return res.status(401).json({
                success: false,
                message: 'Invalid Paystack signature'
            });
        }

        const result = await handlePaystackWebhook(req.body);

        return res.status(200).json({
            success: true,
            message: result.message
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    initialize,
    verify,
    verifyCallback,
    webhook
};