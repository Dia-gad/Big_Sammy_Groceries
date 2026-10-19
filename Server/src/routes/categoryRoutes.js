const express = require('express');

const {
    getCategories,
    getCategory,
    createAdminCategory,
    updateAdminCategory,
    deleteAdminCategory,
} = require('../controllers/categoryController');

const router = express.Router();

// Public
router.get('/', getCategories);
router.get('/:categoryId', getCategory);

// Admin routes will be protected when we connect admin authorization
router.post('/', createAdminCategory);
router.patch('/:categoryId', updateAdminCategory);
router.delete('/:categoryId', deleteAdminCategory);

module.exports = router;