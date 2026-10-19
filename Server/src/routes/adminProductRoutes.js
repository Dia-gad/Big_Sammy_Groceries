const express = require('express');

const {
    createAdminProduct,
    getAdminProduct,
    updateAdminProduct,
    deleteAdminProduct
} = require('../controllers/productController');

const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');

const {
    createProductValidator,
    productIdValidator,
    updateProductValidator
} = require('../validators/productValidator');

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Admin Product Management
|--------------------------------------------------------------------------
*/

/**
 * Create product
 *
 * POST /api/admin/products
 */
router.post(
    '/',
    authenticate,
    authorize('admin', 'manager'),
    createProductValidator,
    validate,
    createAdminProduct
);


/**
 * Get product details for administration
 *
 * GET /api/admin/products/:productId
 */
router.get(
    '/:productId',
    authenticate,
    authorize('admin', 'manager', 'inventory_staff'),
    productIdValidator,
    validate,
    getAdminProduct
);


/**
 * Update product
 *
 * PATCH /api/admin/products/:productId
 */
router.patch(
    '/:productId',
    authenticate,
    authorize('admin', 'manager'),
    productIdValidator,
    updateProductValidator,
    validate,
    updateAdminProduct
);


/**
 * Archive product
 *
 * DELETE /api/admin/products/:productId
 *
 * This performs a soft delete by setting the product
 * and its variants to unavailable.
 */
router.delete(
    '/:productId',
    authenticate,
    authorize('admin'),
    productIdValidator,
    validate,
    deleteAdminProduct
);

module.exports = router;