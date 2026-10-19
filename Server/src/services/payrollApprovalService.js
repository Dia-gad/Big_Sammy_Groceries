const pool = require('../config/database');

const approvePayroll = async ({
    periodId,
    approvedBy
}) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Lock the payroll period so two users cannot approve it simultaneously.
        const periodResult = await client.query(
            `
            SELECT *
            FROM payroll_periods
            WHERE id = $1
            FOR UPDATE
            `,
            [periodId]
        );

        if (periodResult.rowCount === 0) {
            const error = new Error('Payroll period not found');
            error.statusCode = 404;
            throw error;
        }

        const period = periodResult.rows[0];

        if (period.status !== 'processing') {
            const error = new Error(
                `Payroll cannot be approved because the period is currently ${period.status}`
            );

            error.statusCode = 400;
            throw error;
        }

        // Make sure payroll was actually generated.
        const recordsResult = await client.query(
            `
            SELECT
                COUNT(*)::INTEGER AS total_records,
                COUNT(*) FILTER (
                    WHERE status != 'pending'
                )::INTEGER AS non_pending_records
            FROM payroll_records
            WHERE payroll_period_id = $1
            `,
            [periodId]
        );

        const totalRecords = Number(
            recordsResult.rows[0].total_records
        );

        const nonPendingRecords = Number(
            recordsResult.rows[0].non_pending_records
        );

        if (totalRecords === 0) {
            const error = new Error(
                'Cannot approve payroll because no payroll records exist'
            );

            error.statusCode = 400;
            throw error;
        }

        if (nonPendingRecords > 0) {
            const error = new Error(
                'Payroll contains records that are not pending'
            );

            error.statusCode = 400;
            throw error;
        }

        /*
         * Approve all payroll records first.
         */
        await client.query(
            `
            UPDATE payroll_records
            SET
                status = 'approved',
                updated_at = CURRENT_TIMESTAMP
            WHERE
                payroll_period_id = $1
                AND status = 'pending'
            `,
            [periodId]
        );

        /*
         * Then approve the payroll period.
         */
        const updatedPeriodResult = await client.query(
            `
            UPDATE payroll_periods
            SET
                status = 'approved',
                approved_by = $1,
                approved_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
            `,
            [
                approvedBy,
                periodId
            ]
        );

        await client.query('COMMIT');

        return updatedPeriodResult.rows[0];

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};


const getPayrollApprovalSummary = async (periodId) => {
    const result = await pool.query(
        `
        SELECT
            pp.id,
            pp.period_name,
            pp.status,
            pp.approved_by,
            pp.approved_at,

            approver.first_name || ' ' || approver.last_name
                AS approved_by_name,

            COUNT(pr.id)::INTEGER AS staff_count,

            COALESCE(SUM(pr.gross_salary), 0)
                AS total_gross_salary,

            COALESCE(SUM(pr.total_deductions), 0)
                AS total_deductions,

            COALESCE(SUM(pr.net_salary), 0)
                AS total_net_salary

        FROM payroll_periods pp

        LEFT JOIN users approver
            ON approver.id = pp.approved_by

        LEFT JOIN payroll_records pr
            ON pr.payroll_period_id = pp.id
            AND pr.status != 'cancelled'

        WHERE pp.id = $1

        GROUP BY
            pp.id,
            approver.first_name,
            approver.last_name
        `,
        [periodId]
    );

    if (result.rowCount === 0) {
        const error = new Error('Payroll period not found');
        error.statusCode = 404;
        throw error;
    }

    return result.rows[0];
};


module.exports = {
    approvePayroll,
    getPayrollApprovalSummary
};