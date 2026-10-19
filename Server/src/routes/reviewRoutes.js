const express = require('express');

const router = express.Router();


// ============================================================
// MIDDLEWARE
// ============================================================

const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');


// ============================================================
// VALIDATORS
// ============================================================

const {
    createReviewValidator,
    reviewIdValidator,
    productIdValidator,
    updateReviewValidator
} = require('../validators/reviewValidator');


// ============================================================
// CONTROLLERS
// ============================================================

const {
    addReview,
    getReviewsForProduct,
    getCustomerReviews,
    getReview,
    editReview,
    removeReview
} = require('../controllers/reviewController');


// ============================================================
// PRODUCT REVIEWS
// ============================================================

// Get reviews for a product
// GET /api/reviews/product/:productId
router.get(
    '/product/:productId',
    productIdValidator,
    validate,
    getReviewsForProduct
);


// ============================================================
// CUSTOMER REVIEWS
// ============================================================

// Get logged-in customer's reviews
// GET /api/reviews/my-reviews
router.get(
    '/my-reviews',
    authenticate,
    getCustomerReviews
);


// Create product review
// POST /api/reviews
router.post(
    '/',
    authenticate,
    createReviewValidator,
    validate,
    addReview
);


// Get a specific review owned by the logged-in customer
// GET /api/reviews/:id
router.get(
    '/:id',
    authenticate,
    reviewIdValidator,
    validate,
    getReview
);


// Update customer's review
// PATCH /api/reviews/:id
router.patch(
    '/:id',
    authenticate,
    updateReviewValidator,
    validate,
    editReview
);


// Delete customer's review
// DELETE /api/reviews/:id
router.delete(
    '/:id',
    authenticate,
    reviewIdValidator,
    validate,
    removeReview
);


module.exports = router;