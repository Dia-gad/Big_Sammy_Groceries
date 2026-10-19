const {
    getDashboardSummary,
    getSalesOverview,
    getTopSellingProducts,
    getLowStockProducts,
    getRecentOrders
} = require('../services/adminDashboardService');


/**
 * GET /api/admin/dashboard/summary
 *
 * Get high-level dashboard statistics.
 */
const getSummary = async (req, res, next) => {
    try {
        const summary = await getDashboardSummary();

        res.status(200).json({
            success: true,
            data: summary
        });
    } catch (error) {
        next(error);
    }
};


/**
 * GET /api/admin/dashboard/sales
 *
 * Optional:
 * ?startDate=YYYY-MM-DD
 * ?endDate=YYYY-MM-DD
 */
const getSales = async (req, res, next) => {
    try {
        const sales = await getSalesOverview({
            startDate: req.query.startDate || null,
            endDate: req.query.endDate || null
        });

        res.status(200).json({
            success: true,
            filters: {
                startDate: req.query.startDate || null,
                endDate: req.query.endDate || null
            },
            data: sales
        });
    } catch (error) {
        next(error);
    }
};


/**
 * GET /api/admin/dashboard/top-products
 *
 * Optional:
 * ?limit=10
 * ?startDate=YYYY-MM-DD
 * ?endDate=YYYY-MM-DD
 */
const getTopProducts = async (req, res, next) => {
    try {
        const products = await getTopSellingProducts({
            limit: req.query.limit || 10,
            startDate: req.query.startDate || null,
            endDate: req.query.endDate || null
        });

        res.status(200).json({
            success: true,
            filters: {
                limit: Number(req.query.limit) || 10,
                startDate: req.query.startDate || null,
                endDate: req.query.endDate || null
            },
            data: products
        });
    } catch (error) {
        next(error);
    }
};


/**
 * GET /api/admin/dashboard/low-stock
 *
 * Optional:
 * ?threshold=10
 */
const getLowStock = async (req, res, next) => {
    try {
        const products = await getLowStockProducts({
            threshold: req.query.threshold || 10
        });

        res.status(200).json({
            success: true,
            filters: {
                threshold: Number(req.query.threshold) || 10
            },
            data: products
        });
    } catch (error) {
        next(error);
    }
};


/**
 * GET /api/admin/dashboard/recent-orders
 *
 * Optional:
 * ?limit=10
 */
const getRecent = async (req, res, next) => {
    try {
        const orders = await getRecentOrders({
            limit: req.query.limit || 10
        });

        res.status(200).json({
            success: true,
            filters: {
                limit: Number(req.query.limit) || 10
            },
            data: orders
        });
    } catch (error) {
        next(error);
    }
};


module.exports = {
    getSummary,
    getSales,
    getTopProducts,
    getLowStock,
    getRecent
};