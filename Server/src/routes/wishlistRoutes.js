const express = require('express');

const {
    addProductToWishlist,
    getWishlist,
    removeProductFromWishlist
} = require('../controllers/wishlistController');

const {
    addToWishlistValidator
} = require('../validators/wishlistValidator');

const validate = require('../middleware/validate');
const authenticate = require('../middleware/auth');

const router = express.Router();


// Add product to wishlist
router.post(
    '/',
    authenticate,
    addToWishlistValidator,
    validate,
    addProductToWishlist
);


// Get customer's wishlist
router.get(
    '/',
    authenticate,
    getWishlist
);


// Remove product from wishlist
router.delete(
    '/:wishlistItemId',
    authenticate,
    removeProductFromWishlist
);


module.exports = router;