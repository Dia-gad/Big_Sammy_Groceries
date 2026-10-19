const express = require('express');

const {
    createStaff,
    getStaff,
    getStaffById,
    updateStaffRole,
    updateStaffStatus
} = require('../controllers/adminUserController');

const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');

const {
    createStaffValidator,
    userIdValidator,
    changeRoleValidator,
    changeStatusValidator
} = require('../validators/adminUserValidator');

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Admin User Management Routes
|--------------------------------------------------------------------------
*/

/**
 * Create a staff user
 *
 * POST /api/admin/users
 *
 * Allowed roles:
 * - admin
 * - manager
 * - inventory_staff
 * - rider
 */
router.post(
    '/',
    authenticate,
    authorize('admin', 'manager'),
    createStaffValidator,
    validate,
    createStaff
);

/**
 * Get all staff users
 *
 * GET /api/admin/users
 */
router.get(
    '/',
    authenticate,
    authorize('admin', 'manager'),
    getStaff
);

/**
 * Get a single staff user
 *
 * GET /api/admin/users/:userId
 */
router.get(
    '/:userId',
    authenticate,
    authorize('admin', 'manager'),
    userIdValidator,
    validate,
    getStaffById
);

/**
 * Change staff role
 *
 * PATCH /api/admin/users/:userId/role
 *
 * Example:
 * {
 *     "role": "inventory_staff"
 * }
 */
router.patch(
    '/:userId/role',
    authenticate,
    authorize('admin', 'manager'),
    changeRoleValidator,
    validate,
    updateStaffRole
);

/**
 * Activate / deactivate staff account
 *
 * PATCH /api/admin/users/:userId/status
 *
 * Example:
 * {
 *     "isActive": false
 * }
 */
router.patch(
    '/:userId/status',
    authenticate,
    authorize('admin', 'manager'),
    changeStatusValidator,
    validate,
    updateStaffStatus
);

module.exports = router;