const express = require('express');

const {
    getCategories,
    getCategory,
    createAdminCategory,
    updateAdminCategory,
    deleteAdminCategory
} = require('../controllers/categoryController');

const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');

const {
    categoryIdValidator,
    createCategoryValidator,
    updateCategoryValidator
} = require('../validators/categoryValidator');

const router = express.Router();

// Get all categories
router.get(
    '/',
    authenticate,
    authorize('admin', 'manager'),
    getCategories
);

// Get one category
router.get(
    '/:categoryId',
    authenticate,
    authorize('admin', 'manager', 'inventory_staff'),
    categoryIdValidator,
    validate,
    getCategory
);

// Create category
router.post(
    '/',
    authenticate,
    authorize('admin', 'manager'),
    createCategoryValidator,
    validate,
    createAdminCategory
);

// Update category
router.patch(
    '/:categoryId',
    authenticate,
    authorize('admin', 'manager'),
    categoryIdValidator,
    updateCategoryValidator,
    validate,
    updateAdminCategory
);

// Delete category
router.delete(
    '/:categoryId',
    authenticate,
    authorize('admin'),
    categoryIdValidator,
    validate,
    deleteAdminCategory
);

module.exports = router;