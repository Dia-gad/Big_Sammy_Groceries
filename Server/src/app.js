const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const addressRoutes = require('./routes/addressRoutes');
const orderRoutes = require('./routes/orderRoutes');
const adminOrderRoutes = require('./routes/adminOrderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const refundRoutes = require('./routes/refundRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const inventoryAdjustmentRoutes = require('./routes/inventoryAdjustmentRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const riderDeliveryRoutes = require('./routes/riderDeliveryRoutes');
const adminUserRoutes = require('./routes/adminUserRoutes');
const adminCustomerRoutes = require('./routes/adminCustomerRoutes');
const adminDashboardRoutes = require('./routes/adminDashboardRoutes');
const payrollRoutes = require('./routes/payrollRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const profileRoutes = require('./routes/profileRoutes');
const adminProductRoutes = require('./routes/adminProductRoutes');
const adminCategoryRoutes = require('./routes/adminCategoryRoutes');
const adminCouponRoutes = require('./routes/adminCouponRoutes');
const assistantRoutes = require('./routes/assistantRoutes');
const categoryRoutes = require('./routes/categoryRoutes');

const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors());

app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin/orders', adminOrderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin/refunds', refundRoutes);
app.use('/api/admin/products', adminProductRoutes);
app.use('/api/admin/categories', adminCategoryRoutes);
app.use('/api/admin/coupons', adminCouponRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/categories', categoryRoutes);

/*
 * Inventory Adjustment routes must come BEFORE
 * the general inventory routes.
 *
 * This prevents:
 *
 * /adjustments
 *
 * from being interpreted as:
 *
 * /:variantId
 */
app.use(
    '/api/admin/inventory/adjustments',
    inventoryAdjustmentRoutes
);

app.use(
    '/api/admin/inventory',
    inventoryRoutes
);

app.use('/api/admin/deliveries', deliveryRoutes);
app.use('/api/rider/deliveries', riderDeliveryRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/customers', adminCustomerRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/payroll', payrollRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/profile', profileRoutes);

app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Big Sammy Groceries API is running',
    });
});

app.use(errorHandler);

module.exports = app;