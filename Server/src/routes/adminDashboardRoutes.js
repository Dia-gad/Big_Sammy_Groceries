const express = require('express');

const {
    getSummary,
    getSales,
    getTopProducts,
    getLowStock,
    getRecent
} = require('../controllers/adminDashboardController');

const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');

const {
    salesOverviewValidator
} = require('../validators/adminDashboardValidator');

const router = express.Router();


/**
 * Dashboard summary
 *
 * GET /api/admin/dashboard/summary
 */
router.get(
    '/summary',
    authenticate,
    authorize('admin', 'manager'),
    getSummary
);


/**
 * Sales overview
 *
 * GET /api/admin/dashboard/sales
 *
 * Optional:
 * ?startDate=2026-10-01
 * ?endDate=2026-10-03
 */
router.get(
    '/sales',
    authenticate,
    authorize('admin', 'manager'),
    salesOverviewValidator,
    validate,
    getSales
);


/**
 * Top-selling products
 *
 * GET /api/admin/dashboard/top-products
 *
 * Optional:
 * ?limit=10
 * ?startDate=2026-10-01
 * ?endDate=2026-10-03
 */
router.get(
    '/top-products',
    authenticate,
    authorize('admin', 'manager'),
    salesOverviewValidator,
    validate,
    getTopProducts
);


/**
 * Low-stock products
 *
 * GET /api/admin/dashboard/low-stock
 *
 * Optional:
 * ?threshold=10
 */
router.get(
    '/low-stock',
    authenticate,
    authorize('admin', 'manager'),
    getLowStock
);

router.get(
    '/recent-orders',
    authenticate,
    authorize('admin', 'manager'),
    getRecent
);


module.exports = router;