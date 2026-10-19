require('dotenv').config();

const app = require('./app');
require('./config/database');

const { runRefundReconciliation } = require('./jobs/refundReconciliationJob');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);

    // Run refund reconciliation when the server starts
    runRefundReconciliation();

    // Check pending refunds every 10 minutes
    setInterval(() => {
        runRefundReconciliation();
    }, 10 * 60 * 1000);
});