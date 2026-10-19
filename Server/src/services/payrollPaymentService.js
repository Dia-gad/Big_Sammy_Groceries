const pool = require('../config/database');

const PAYMENT_METHODS = [
    'bank_transfer',
    'cash',
    'other'
];

const PAYMENT_STATUSES = [
    'pending',
    'processing',
    'paid',
    'failed',
    'cancelled'
];


/**
 * Get a payroll record and its payment information.
 */
const getPayrollRecord = async (client, payrollRecordId) => {
    const result = await client.query(
        `
        SELECT
            pr.id,
            pr.payroll_period_id,
            pr.user_id,
            pr.salary_structure_id,
            pr.basic_salary,
            pr.total_allowances,
            pr.total_deductions,
            pr.gross_salary,
            pr.net_salary,
            pr.status AS payroll_status,

            pp.period_name,
            pp.status AS payroll_period_status,

            u.first_name,
            u.last_name,
            u.email,
            u.role

        FROM payroll_records pr

        INNER JOIN payroll_periods pp
            ON pp.id = pr.payroll_period_id

        INNER JOIN users u
            ON u.id = pr.user_id

        WHERE pr.id = $1
        `,
        [payrollRecordId]
    );

    if (result.rowCount === 0) {
        const error = new Error('Payroll record not found');
        error.statusCode = 404;
        throw error;
    }

    return result.rows[0];
};


/**
 * Get existing payment for a payroll record.
 */
const getExistingPayment = async (client, payrollRecordId) => {
    const result = await client.query(
        `
        SELECT
            sp.*,

            processor.first_name || ' ' || processor.last_name
                AS processed_by_name

        FROM salary_payments sp

        LEFT JOIN users processor
            ON processor.id = sp.processed_by

        WHERE sp.payroll_record_id = $1

        ORDER BY sp.id DESC

        LIMIT 1
        `,
        [payrollRecordId]
    );

    return result.rows[0] || null;
};


/**
 * Create a salary payment.
 */
const createSalaryPayment = async ({
    payrollRecordId,
    paymentMethod,
    paymentReference,
    processedBy,
    notes
}) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        /*
         * Lock payroll record.
         */
        const payrollRecord = await getPayrollRecord(
            client,
            payrollRecordId
        );

        /*
         * Payroll must be approved before payment.
         */
        if (payrollRecord.payroll_status !== 'approved') {
            const error = new Error(
                `Salary cannot be paid because the payroll record is ${payrollRecord.payroll_status}`
            );

            error.statusCode = 400;
            throw error;
        }

        /*
         * Payroll period must also be approved.
         */
        if (payrollRecord.payroll_period_status !== 'approved') {
            const error = new Error(
                `Salary cannot be paid because the payroll period is ${payrollRecord.payroll_period_status}`
            );

            error.statusCode = 400;
            throw error;
        }

        /*
         * Prevent duplicate payment.
         */
        const existingPayment = await getExistingPayment(
            client,
            payrollRecordId
        );

        if (
            existingPayment &&
            ['pending', 'processing', 'paid'].includes(
                existingPayment.payment_status
            )
        ) {
            const error = new Error(
                `A salary payment already exists for this payroll record with status ${existingPayment.payment_status}`
            );

            error.statusCode = 409;
            throw error;
        }

        /*
         * Payment reference must be unique.
         */
        const referenceResult = await client.query(
            `
            SELECT id
            FROM salary_payments
            WHERE payment_reference = $1
            LIMIT 1
            `,
            [paymentReference]
        );

        if (referenceResult.rowCount > 0) {
            const error = new Error(
                'Payment reference already exists'
            );

            error.statusCode = 409;
            throw error;
        }

        /*
         * Create payment as processing.
         *
         * We deliberately do not mark it as paid immediately.
         * A payment processor/accounting workflow can update it
         * after the actual transaction is confirmed.
         */
        const paymentResult = await client.query(
            `
            INSERT INTO salary_payments (
                payroll_record_id,
                user_id,
                amount,
                payment_method,
                payment_reference,
                payment_status,
                processed_by,
                notes
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                'processing',
                $6,
                $7
            )
            RETURNING *
            `,
            [
                payrollRecord.id,
                payrollRecord.user_id,
                payrollRecord.net_salary,
                paymentMethod,
                paymentReference,
                processedBy,
                notes || null
            ]
        );

        await client.query('COMMIT');

        return paymentResult.rows[0];

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};


/**
 * Mark a salary payment as paid.
 */
const markSalaryPaymentPaid = async ({
    paymentId,
    processedBy
}) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        /*
         * Lock payment.
         */
        const paymentResult = await client.query(
            `
            SELECT
                sp.*,
                pr.payroll_period_id,
                pr.status AS payroll_record_status,
                pp.status AS payroll_period_status

            FROM salary_payments sp

            INNER JOIN payroll_records pr
                ON pr.id = sp.payroll_record_id

            INNER JOIN payroll_periods pp
                ON pp.id = pr.payroll_period_id

            WHERE sp.id = $1

            FOR UPDATE OF sp
            `,
            [paymentId]
        );

        if (paymentResult.rowCount === 0) {
            const error = new Error(
                'Salary payment not found'
            );

            error.statusCode = 404;
            throw error;
        }

        const payment = paymentResult.rows[0];

        if (payment.payment_status === 'paid') {
            const error = new Error(
                'Salary payment has already been marked as paid'
            );

            error.statusCode = 409;
            throw error;
        }

        if (payment.payment_status !== 'processing') {
            const error = new Error(
                `Payment cannot be completed because its status is ${payment.payment_status}`
            );

            error.statusCode = 400;
            throw error;
        }

        /*
         * Mark payment as paid.
         */
        const updatedPaymentResult = await client.query(
            `
            UPDATE salary_payments
            SET
                payment_status = 'paid',
                paid_at = CURRENT_TIMESTAMP,
                processed_by = $1
            WHERE id = $2
            RETURNING *
            `,
            [
                processedBy,
                paymentId
            ]
        );

        /*
         * Mark payroll record as paid.
         */
        await client.query(
            `
            UPDATE payroll_records
            SET
                status = 'paid',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            `,
            [payment.payroll_record_id]
        );

        /*
         * Check whether every payroll record in the period
         * has now been paid.
         */
        const remainingResult = await client.query(
            `
            SELECT COUNT(*)::INTEGER AS remaining
            FROM payroll_records
            WHERE
                payroll_period_id = $1
                AND status != 'paid'
                AND status != 'cancelled'
            `,
            [payment.payroll_period_id]
        );

        const remaining =
            Number(remainingResult.rows[0].remaining);

        /*
         * If every payroll record has been paid,
         * mark the payroll period as paid.
         */
        if (remaining === 0) {
            await client.query(
                `
                UPDATE payroll_periods
                SET
                    status = 'paid',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                `,
                [payment.payroll_period_id]
            );
        }

        await client.query('COMMIT');

        return updatedPaymentResult.rows[0];

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};


/**
 * Get a salary payment by ID.
 */
const getSalaryPaymentById = async (paymentId) => {
    const result = await pool.query(
        `
        SELECT
            sp.id,
            sp.payroll_record_id,
            sp.user_id,
            sp.amount,
            sp.payment_method,
            sp.payment_reference,
            sp.payment_status,
            sp.paid_at,
            sp.processed_by,
            sp.notes,
            sp.created_at,

            u.first_name,
            u.last_name,
            u.email,

            pr.payroll_period_id,
            pr.basic_salary,
            pr.total_allowances,
            pr.total_deductions,
            pr.gross_salary,
            pr.net_salary,

            pp.period_name,

            processor.first_name || ' ' || processor.last_name
                AS processed_by_name

        FROM salary_payments sp

        INNER JOIN users u
            ON u.id = sp.user_id

        INNER JOIN payroll_records pr
            ON pr.id = sp.payroll_record_id

        INNER JOIN payroll_periods pp
            ON pp.id = pr.payroll_period_id

        LEFT JOIN users processor
            ON processor.id = sp.processed_by

        WHERE sp.id = $1
        `,
        [paymentId]
    );

    if (result.rowCount === 0) {
        const error = new Error(
            'Salary payment not found'
        );

        error.statusCode = 404;
        throw error;
    }

    return result.rows[0];
};


/**
 * Get payments for a payroll period.
 */
const getPayrollPayments = async (periodId) => {
    const result = await pool.query(
        `
        SELECT
            sp.id,
            sp.payroll_record_id,
            sp.user_id,
            sp.amount,
            sp.payment_method,
            sp.payment_reference,
            sp.payment_status,
            sp.paid_at,
            sp.processed_by,
            sp.notes,
            sp.created_at,

            u.first_name,
            u.last_name,
            u.email,
            u.role,

            processor.first_name || ' ' || processor.last_name
                AS processed_by_name

        FROM salary_payments sp

        INNER JOIN users u
            ON u.id = sp.user_id

        LEFT JOIN users processor
            ON processor.id = sp.processed_by

        INNER JOIN payroll_records pr
            ON pr.id = sp.payroll_record_id

        WHERE pr.payroll_period_id = $1

        ORDER BY sp.id ASC
        `,
        [periodId]
    );

    return result.rows;
};


module.exports = {
    PAYMENT_METHODS,
    PAYMENT_STATUSES,
    createSalaryPayment,
    markSalaryPaymentPaid,
    getSalaryPaymentById,
    getPayrollPayments
};