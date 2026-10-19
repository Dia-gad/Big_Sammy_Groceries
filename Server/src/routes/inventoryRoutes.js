const express = require('express');

const {
    getAllInventory,
    getSingleVariantInventory,
    getVariantMovements
} = require('../controllers/inventoryController');

const {
    variantIdValidator
} = require('../validators/inventoryValidator');

const validate = require('../middleware/validate');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.get(
    '/',
    authenticate,
    authorize('admin', 'manager', 'inventory_staff'),
    getAllInventory
);

router.get(
    '/:variantId/movements',
    authenticate,
    authorize('admin', 'manager', 'inventory_staff'),
    variantIdValidator,
    validate,
    getVariantMovements
);

router.get(
    '/:variantId',
    authenticate,
    authorize('admin', 'manager', 'inventory_staff'),
    variantIdValidator,
    validate,
    getSingleVariantInventory
);

module.exports = router;