const express = require('express');

const {
    createAdjustmentRequest,
    approveInventoryAdjustment,
    rejectInventoryAdjustment,
    getSingleAdjustmentRequest,
    getAllAdjustmentRequests
} = require('../controllers/inventoryAdjustmentController');

const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');

const {
    createAdjustmentValidator,
    requestIdValidator,
    reviewAdjustmentValidator,
    rejectAdjustmentValidator,
    adjustmentStatusValidator
} = require('../validators/inventoryAdjustmentValidator');

const router = express.Router();


/*
 * Inventory Staff / Admin
 * Submit an adjustment request.
 */
router.post(
    '/',
    authenticate,
    authorize('inventory_staff', 'admin'),
    createAdjustmentValidator,
    validate,
    createAdjustmentRequest
);


/*
 * Manager / Admin
 * View adjustment requests.
 */
router.get(
    '/',
    authenticate,
    authorize('manager', 'admin'),
    adjustmentStatusValidator,
    validate,
    getAllAdjustmentRequests
);


/*
 * Manager / Admin
 * View one adjustment request.
 */
router.get(
    '/:requestId',
    authenticate,
    authorize('manager', 'admin'),
    requestIdValidator,
    validate,
    getSingleAdjustmentRequest
);


/*
 * Manager / Admin
 * Approve adjustment.
 */
router.patch(
    '/:requestId/approve',
    authenticate,
    authorize('manager', 'admin'),
    requestIdValidator,
    reviewAdjustmentValidator,
    validate,
    approveInventoryAdjustment
);


/*
 * Manager / Admin
 * Reject adjustment.
 */
router.patch(
    '/:requestId/reject',
    authenticate,
    authorize('manager', 'admin'),
    requestIdValidator,
    rejectAdjustmentValidator,
    validate,
    rejectInventoryAdjustment
);


module.exports = router;