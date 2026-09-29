const {
    addToWishlist,
    getMyWishlist,
    removeFromWishlist
} = require('../services/wishlistService');


const addProductToWishlist = async (req, res, next) => {
    try {
        const { product_id } = req.body;

        const wishlistItem = await addToWishlist(
            req.user.userId,
            product_id
        );

        res.status(201).json({
            success: true,
            message: 'Product added to wishlist',
            data: wishlistItem
        });

    } catch (error) {
        next(error);
    }
};


const getWishlist = async (req, res, next) => {
    try {
        const wishlist = await getMyWishlist(
            req.user.userId
        );

        res.status(200).json({
            success: true,
            data: wishlist
        });

    } catch (error) {
        next(error);
    }
};


const removeProductFromWishlist = async (req, res, next) => {
    try {
        const { wishlistItemId } = req.params;

        const wishlistItem = await removeFromWishlist(
            req.user.userId,
            wishlistItemId
        );

        res.status(200).json({
            success: true,
            message: 'Product removed from wishlist',
            data: wishlistItem
        });

    } catch (error) {
        next(error);
    }
};


module.exports = {
    addProductToWishlist,
    getWishlist,
    removeProductFromWishlist
};