const {
    addToCart,
    getMyCart,
    updateCartItem,
    removeCartItem,
} = require('../services/cartService');

const addProductToCart = async (req, res, next) => {
    try {
        const { product_id, quantity } = req.body;

        const cartItem = await addToCart(
            req.user.userId,
            product_id,
            quantity
        );

        res.status(201).json({
            success: true,
            message: 'Product added to cart',
            data: cartItem,
        });
    } catch (error) {
        next(error);
    }
};

const getCart = async (req, res, next) => {
    try {
        const cart = await getMyCart(req.user.userId);

        res.status(200).json({
            success: true,
            data: cart,
        });
    } catch (error) {
        next(error);
    }
};

const updateCart = async (req, res, next) => {
    try {
        const { quantity } = req.body;
        const { cartItemId } = req.params;

        const cartItem = await updateCartItem(
            req.user.userId,
            cartItemId,
            quantity
        );

        res.status(200).json({
            success: true,
            message: 'Cart updated successfully',
            data: cartItem,
        });
    } catch (error) {
        next(error);
    }
};

const removeFromCart = async (req, res, next) => {
    try {
        const { cartItemId } = req.params;

        const cartItem = await removeCartItem(
            req.user.userId,
            cartItemId
        );

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
    addProductToCart,
    getCart,
    updateCart,
    removeFromCart,
};