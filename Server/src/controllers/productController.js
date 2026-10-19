const {
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    archiveProduct,
    getAdminProductById
} = require('../services/productService');


/*
|--------------------------------------------------------------------------
| Customer Product Controllers
|--------------------------------------------------------------------------
*/

const getProducts = async (req, res, next) => {
    try {
        const {
            search,
            category,
            minPrice,
            maxPrice,
            featured
        } = req.query;

        const products = await getAllProducts(
            search,
            category,
            minPrice,
            maxPrice,
            featured
        );

        res.status(200).json({
            success: true,
            data: products
        });
    } catch (error) {
        next(error);
    }
};


const getProduct = async (req, res, next) => {
    try {
        const product = await getProductById(
            req.params.productId
        );

        res.status(200).json({
            success: true,
            data: product
        });
    } catch (error) {
        next(error);
    }
};


/*
|--------------------------------------------------------------------------
| Admin Product Controllers
|--------------------------------------------------------------------------
*/

const createAdminProduct = async (req, res, next) => {
    try {
        const product = await createProduct(req.body);

        res.status(201).json({
            success: true,
            message: 'Product created successfully',
            data: product
        });
    } catch (error) {
        next(error);
    }
};


const getAdminProduct = async (req, res, next) => {
    try {
        const product = await getAdminProductById(
            req.params.productId
        );

        res.status(200).json({
            success: true,
            data: product
        });
    } catch (error) {
        next(error);
    }
};


const updateAdminProduct = async (req, res, next) => {
    try {
        const product = await updateProduct(
            req.params.productId,
            req.body
        );

        res.status(200).json({
            success: true,
            message: 'Product updated successfully',
            data: product
        });
    } catch (error) {
        next(error);
    }
};


const deleteAdminProduct = async (req, res, next) => {
    try {
        const product = await archiveProduct(
            req.params.productId
        );

        res.status(200).json({
            success: true,
            message: 'Product archived successfully',
            data: product
        });
    } catch (error) {
        next(error);
    }
};


module.exports = {
    getProducts,
    getProduct,

    createAdminProduct,
    getAdminProduct,
    updateAdminProduct,
    deleteAdminProduct
};