const express = require('express');

const {
    getAllCustomers,
    getCustomer,
    updateCustomerStatus
} = require('../controllers/adminCustomerController');

const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');

const {
    userIdValidator,
    changeCustomerStatusValidator
} = require('../validators/adminCustomerValidator');

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Admin Customer Management Routes
|--------------------------------------------------------------------------
*/

/**
 * Get all customers
 *
 * GET /api/admin/customers
 */
router.get(
    '/',
    authenticate,
    authorize('admin', 'manager'),
    getAllCustomers
);

/**
 * Get a single customer
 *
 * GET /api/admin/customers/:userId
 */
router.get(
    '/:userId',
    authenticate,
    authorize('admin', 'manager'),
    userIdValidator,
    validate,
    getCustomer
);

/**
 * Activate / deactivate customer
 *
 * PATCH /api/admin/customers/:userId/status
 */
router.patch(
    '/:userId/status',
    authenticate,
    authorize('admin', 'manager'),
    changeCustomerStatusValidator,
    validate,
    updateCustomerStatus
);

module.exports = router;