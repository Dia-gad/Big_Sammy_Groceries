const {
    getAllCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory
} = require('../services/categoryService');

const getCategories = async (req, res, next) => {
    try {
        const categories = await getAllCategories();

        res.status(200).json({
            success: true,
            data: categories
        });
    } catch (error) {
        next(error);
    }
};

const getCategory = async (req, res, next) => {
    try {
        const category = await getCategoryById(req.params.categoryId);

        res.status(200).json({
            success: true,
            data: category
        });
    } catch (error) {
        next(error);
    }
};

const createAdminCategory = async (req, res, next) => {
    try {
        const category = await createCategory(req.body);

        res.status(201).json({
            success: true,
            message: 'Category created successfully',
            data: category
        });
    } catch (error) {
        next(error);
    }
};

const updateAdminCategory = async (req, res, next) => {
    try {
        const category = await updateCategory(
            req.params.categoryId,
            req.body
        );

        res.status(200).json({
            success: true,
            message: 'Category updated successfully',
            data: category
        });
    } catch (error) {
        next(error);
    }
};

const deleteAdminCategory = async (req, res, next) => {
    try {
        const result = await deleteCategory(req.params.categoryId);

        res.status(200).json({
            success: true,
            message: 'Category deleted successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getCategories,
    getCategory,
    createAdminCategory,
    updateAdminCategory,
    deleteAdminCategory
};