const { reconcilePendingRefunds } = require('../services/refundReconciliationService');

let isRunning = false;

const runRefundReconciliation = async () => {
    if (isRunning) {
        console.log('[Refund Reconciliation] Previous run still in progress. Skipping.');
        return;
    }

    isRunning = true;

    try {
        const result = await reconcilePendingRefunds({
            limit: 20
        });

        if (result.checked > 0) {
            console.log(
                `[Refund Reconciliation] Checked ${result.checked} refund(s)`
            );
        } else {
            console.log('[Refund Reconciliation] No pending refunds to check.');
        }

        return result;
    } catch (error) {
        console.error(
            '[Refund Reconciliation] Failed:',
            error.message
        );
    } finally {
        isRunning = false;
    }
};

module.exports = {
    runRefundReconciliation
};