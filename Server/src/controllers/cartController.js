const {
    addProductToCart,
    getCart,
    updateCart,
    removeFromCart,
} = require('../services/cartService');


const addProductToCartController = async (req, res, next) => {
    try {
        const { variantId, quantity } = req.body;

        const cartItem = await addProductToCart({
            userId: req.user.userId,
            variantId,
            quantity
        });

        res.status(201).json({
            success: true,
            message: 'Product added to cart',
            data: cartItem,
        });
    } catch (error) {
        next(error);
    }
};


const getMyCart = async (req, res, next) => {
    try {
        const cart = await getCart(req.user.userId);

        res.status(200).json({
            success: true,
            data: cart,
        });
    } catch (error) {
        next(error);
    }
};


const updateCartItem = async (req, res, next) => {
    try {
        const { quantity } = req.body;
        const { variantId } = req.params;

        const cartItem = await updateCart({
            userId: req.user.userId,
            variantId,
            quantity
        });

        res.status(200).json({
            success: true,
            message: 'Cart updated successfully',
            data: cartItem,
        });
    } catch (error) {
        next(error);
    }
};


const removeCartItem = async (req, res, next) => {
    try {
        const { variantId } = req.params;

        const cartItem = await removeFromCart({
            userId: req.user.userId,
            variantId
        });

        res.status(200).json({
            success: true,
            message: 'Product removed from cart',
            data: cartItem,
        });
    } catch (error) {
        next(error);
    }
};


module.exports = {
    addProductToCart: addProductToCartController,
    getCart: getMyCart,
    updateCart: updateCartItem,
    removeFromCart: removeCartItem,
};