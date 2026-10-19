const express = require('express');

const {
    getDeliveries,
    getDelivery,
    pickup,
    start,
    complete,
    fail
} = require('../controllers/riderDeliveryController');

const authenticate =
    require('../middleware/auth');

const authorize =
    require('../middleware/authorize');

const validate =
    require('../middleware/validate');

const {
    assignmentIdValidator,
    deliveryNoteValidator,
    failureValidator
} = require('../validators/riderDeliveryValidator');


const router = express.Router();


// =========================================================
// RIDER DELIVERY ROUTES
// =========================================================

// View all deliveries assigned to logged-in rider
router.get(
    '/',
    authenticate,
    authorize('rider'),
    getDeliveries
);


// View one assigned delivery
router.get(
    '/:assignmentId',
    authenticate,
    authorize('rider'),
    assignmentIdValidator,
    validate,
    getDelivery
);


// Rider picks up order
router.patch(
    '/:assignmentId/pickup',
    authenticate,
    authorize('rider'),
    deliveryNoteValidator,
    validate,
    pickup
);


// Rider starts delivery
router.patch(
    '/:assignmentId/out-for-delivery',
    authenticate,
    authorize('rider'),
    deliveryNoteValidator,
    validate,
    start
);


// Rider completes delivery
router.patch(
    '/:assignmentId/delivered',
    authenticate,
    authorize('rider'),
    deliveryNoteValidator,
    validate,
    complete
);


// Rider reports failed delivery
router.patch(
    '/:assignmentId/failed',
    authenticate,
    authorize('rider'),
    failureValidator,
    validate,
    fail
);


module.exports = router;