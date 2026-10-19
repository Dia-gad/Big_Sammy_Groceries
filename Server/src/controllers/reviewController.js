const {
    createReview,
    getProductReviews,
    getMyReviews,
    getReviewById,
    updateReview,
    deleteReview
} = require('../services/reviewService');


// ============================================================
// CREATE REVIEW
// ============================================================

const addReview = async (req, res, next) => {
    try {
        const {
            product_id,
            order_item_id,
            rating,
            review
        } = req.body;

        const result = await createReview({
            userId: req.user.userId,
            productId: product_id,
            orderItemId: order_item_id,
            rating,
            review
        });

        return res.status(201).json({
            success: true,
            message: 'Product review submitted successfully',
            data: result
        });

    } catch (error) {
        next(error);
    }
};


// ============================================================
// GET PRODUCT REVIEWS
// ============================================================

const getReviewsForProduct = async (req, res, next) => {
    try {
        const { productId } = req.params;

        const reviews = await getProductReviews(
            Number(productId)
        );

        return res.status(200).json({
            success: true,
            data: {
                product_id: Number(productId),
                reviews
            }
        });

    } catch (error) {
        next(error);
    }
};


// ============================================================
// GET MY REVIEWS
// ============================================================

const getCustomerReviews = async (req, res, next) => {
    try {
        const reviews = await getMyReviews(
            req.user.userId
        );

        return res.status(200).json({
            success: true,
            data: reviews
        });

    } catch (error) {
        next(error);
    }
};


// ============================================================
// GET SINGLE REVIEW
// ============================================================

const getReview = async (req, res, next) => {
    try {
        const { id } = req.params;

        const review = await getReviewById({
            reviewId: Number(id),
            userId: req.user.userId
        });

        return res.status(200).json({
            success: true,
            data: review
        });

    } catch (error) {
        next(error);
    }
};


// ============================================================
// UPDATE REVIEW
// ============================================================

const editReview = async (req, res, next) => {
    try {
        const { id } = req.params;
        const {
            rating,
            review
        } = req.body;

        const updatedReview = await updateReview({
            userId: req.user.userId,
            reviewId: Number(id),
            rating,
            review
        });

        return res.status(200).json({
            success: true,
            message: 'Review updated successfully',
            data: updatedReview
        });

    } catch (error) {
        next(error);
    }
};


// ============================================================
// DELETE REVIEW
// ============================================================

const removeReview = async (req, res, next) => {
    try {
        const { id } = req.params;

        const deletedReview = await deleteReview({
            userId: req.user.userId,
            reviewId: Number(id)
        });

        return res.status(200).json({
            success: true,
            message: 'Review deleted successfully',
            data: deletedReview
        });

    } catch (error) {
        next(error);
    }
};


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    addReview,
    getReviewsForProduct,
    getCustomerReviews,
    getReview,
    editReview,
    removeReview
};