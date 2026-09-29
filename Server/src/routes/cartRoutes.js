const express = require('express');

const {
    addProductToCart,
    getCart,
    updateCart,
    removeFromCart
} = require('../controllers/cartController');

const {
    addToCartValidator,
    updateCartValidator
} = require('../validators/cartValidator');

const validate = require('../middleware/validate');
const authenticate = require('../middleware/auth');

const router = express.Router();

// Add product to cart
router.post(
    '/',
    authenticate,
    addToCartValidator,
    validate,
    addProductToCart
);

// Get my cart
router.get(
    '/',
    authenticate,
    getCart
);

// Update cart item
router.put(
    '/:cartItemId',
    authenticate,
    updateCartValidator,
    validate,
    updateCart
);

// Remove cart item
router.delete(
    '/:cartItemId',
    authenticate,
    removeFromCart
);

module.exports = router;