const express = require('express');

const {
    initialize,
    retry,
    verify,
    verifyCallback,
    webhook
} = require('../controllers/paymentController');

const {
    initializePaymentValidator,
    retryPaymentValidator
} = require('../validators/paymentValidator');

const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.post(
    '/retry',
    authenticate,
    retryPaymentValidator,
    validate,
    retry
);

router.post(
    '/initialize',
    authenticate,
    initializePaymentValidator,
    validate,
    initialize
);

router.get(
    '/callback',
    verifyCallback
);

router.get(
    '/verify/:reference',
    authenticate,
    verify
);

router.post(
    '/webhook/paystack',
    webhook
);

router.get(
    '/callback',
    verifyCallback
);

module.exports = router;