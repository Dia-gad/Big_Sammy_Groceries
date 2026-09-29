const {
    getAllProducts,
    getProductById,
} = require('../services/productService');

const getProducts = async (req, res, next) => {
    try {
        const {
            search,
            category,
            min_price,
            max_price,
        } = req.query;

        const products = await getAllProducts(
            search,
            category,
            min_price,
            max_price
        );

        res.status(200).json({
            success: true,
            data: products,
        });
    } catch (error) {
        next(error);
    }
};

const getProduct = async (req, res, next) => {
    try {
        const { id } = req.params;

        const product = await getProductById(id);

        res.status(200).json({
            success: true,
            data: product,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getProducts,
    getProduct,
};