const crypto = require('crypto');
const pool = require('../config/database');


/**
 * Generate a unique payslip number.
 *
 * Example:
 * BS-PAY-2026-A8F31C92
 */
const generatePayslipNumber = () => {
    const year = new Date().getFullYear();

    const randomPart = crypto
        .randomBytes(4)
        .toString('hex')
        .toUpperCase();

    return `BS-PAY-${year}-${randomPart}`;
};


/**
 * Get complete payroll information required for a payslip.
 */
const getPayrollData = async (client, payrollRecordId) => {
    const result = await client.query(
        `
        SELECT
            pr.id AS payroll_record_id,
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
            pp.start_date,
            pp.end_date,
            pp.payment_date,
            pp.status AS payroll_period_status,

            u.first_name,
            u.last_name,
            u.email,
            u.phone,
            u.role

        FROM payroll_records pr

        INNER JOIN payroll_periods pp
            ON pp.id = pr.payroll_period_id

        INNER JOIN users u
            ON u.id = pr.user_id

        WHERE pr.id = $1

        FOR UPDATE OF pr
        `,
        [payrollRecordId]
    );

    if (result.rowCount === 0) {
        const error = new Error(
            'Payroll record not found'
        );

        error.statusCode = 404;

        throw error;
    }

    return result.rows[0];
};


/**
 * Get payroll items.
 */
const getPayrollItems = async (client, payrollRecordId) => {
    const result = await client.query(
        `
        SELECT
            id,
            item_type,
            item_name,
            amount,
            created_at
        FROM payroll_items
        WHERE payroll_record_id = $1
        ORDER BY
            CASE
                WHEN item_type = 'allowance' THEN 1
                WHEN item_type = 'deduction' THEN 2
                ELSE 3
            END,
            id ASC
        `,
        [payrollRecordId]
    );

    return result.rows;
};


/**
 * Get the successful salary payment associated
 * with the payroll record.
 */
const getPayrollPayment = async (client, payrollRecordId) => {
    const result = await client.query(
        `
        SELECT
            sp.id,
            sp.amount,
            sp.payment_method,
            sp.payment_reference,
            sp.payment_status,
            sp.paid_at,
            sp.processed_by,

            processor.first_name || ' ' || processor.last_name
                AS processed_by_name

        FROM salary_payments sp

        LEFT JOIN users processor
            ON processor.id = sp.processed_by

        WHERE
            sp.payroll_record_id = $1
            AND sp.payment_status = 'paid'

        ORDER BY sp.id DESC

        LIMIT 1
        `,
        [payrollRecordId]
    );

    return result.rows[0] || null;
};


/**
 * Generate a payslip for a paid payroll record.
 */
const generatePayslip = async ({
    payrollRecordId,
    generatedBy
}) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        /*
         * Lock payroll record while generating payslip.
         */
        const payroll = await getPayrollData(
            client,
            payrollRecordId
        );

        /*
         * Payslip can only be generated after
         * payroll has been paid.
         */
        if (payroll.payroll_status !== 'paid') {
            const error = new Error(
                `Payslip cannot be generated because payroll status is ${payroll.payroll_status}`
            );

            error.statusCode = 400;

            throw error;
        }

        /*
         * Payroll period must also be paid.
         */
        if (payroll.payroll_period_status !== 'paid') {
            const error = new Error(
                `Payslip cannot be generated because payroll period status is ${payroll.payroll_period_status}`
            );

            error.statusCode = 400;

            throw error;
        }

        /*
         * Confirm an actual salary payment exists.
         */
        const payment = await getPayrollPayment(
            client,
            payrollRecordId
        );

        if (!payment) {
            const error = new Error(
                'No completed salary payment was found for this payroll record'
            );

            error.statusCode = 400;

            throw error;
        }

        /*
         * Payslips are one-to-one with payroll records.
         *
         * If one already exists, return it instead of
         * creating a duplicate.
         */
        const existingResult = await client.query(
            `
            SELECT
                p.id,
                p.payroll_record_id,
                p.user_id,
                p.payslip_number,
                p.issued_at,
                p.generated_by,

                generator.first_name || ' ' || generator.last_name
                    AS generated_by_name

            FROM payslips p

            LEFT JOIN users generator
                ON generator.id = p.generated_by

            WHERE p.payroll_record_id = $1

            LIMIT 1
            `,
            [payrollRecordId]
        );

        if (existingResult.rowCount > 0) {
            const existingPayslip = existingResult.rows[0];

            await client.query('COMMIT');

            return {
                ...existingPayslip,
                already_existed: true
            };
        }

        /*
         * Load payroll items.
         */
        const items = await getPayrollItems(
            client,
            payrollRecordId
        );

        const allowances = items.filter(
            item => item.item_type === 'allowance'
        );

        const deductions = items.filter(
            item => item.item_type === 'deduction'
        );

        /*
         * Generate unique payslip number.
         */
        let payslipNumber;
        let inserted = false;
        let payslipResult;

        /*
         * Very small retry mechanism protects against
         * an extremely unlikely random collision.
         */
        for (let attempt = 0; attempt < 5; attempt++) {
            payslipNumber = generatePayslipNumber();

            try {
                payslipResult = await client.query(
                    `
                    INSERT INTO payslips (
                        payroll_record_id,
                        user_id,
                        payslip_number,
                        issued_at,
                        generated_by
                    )
                    VALUES (
                        $1,
                        $2,
                        $3,
                        CURRENT_TIMESTAMP,
                        $4
                    )
                    RETURNING *
                    `,
                    [
                        payrollRecordId,
                        payroll.user_id,
                        payslipNumber,
                        generatedBy
                    ]
                );

                inserted = true;

                break;

            } catch (error) {
                /*
                 * PostgreSQL unique violation.
                 *
                 * If another request created the payslip
                 * at the same time, retrieve it instead.
                 */
                if (error.code !== '23505') {
                    throw error;
                }

                const concurrentResult = await client.query(
                    `
                    SELECT *
                    FROM payslips
                    WHERE payroll_record_id = $1
                    LIMIT 1
                    `,
                    [payrollRecordId]
                );

                if (concurrentResult.rowCount > 0) {
                    payslipResult = concurrentResult;

                    inserted = false;

                    break;
                }
            }
        }

        if (!payslipResult || payslipResult.rowCount === 0) {
            const error = new Error(
                'Unable to generate a unique payslip number'
            );

            error.statusCode = 500;

            throw error;
        }

        const payslip = payslipResult.rows[0];

        await client.query('COMMIT');

        return {
            id: payslip.id,
            payroll_record_id: payroll.payroll_record_id,
            user_id: payroll.user_id,

            payslip_number: payslip.payslip_number,
            issued_at: payslip.issued_at,

            employee: {
                first_name: payroll.first_name,
                last_name: payroll.last_name,
                email: payroll.email,
                phone: payroll.phone,
                role: payroll.role
            },

            payroll_period: {
                id: payroll.payroll_period_id,
                period_name: payroll.period_name,
                start_date: payroll.start_date,
                end_date: payroll.end_date,
                payment_date: payroll.payment_date
            },

            earnings: {
                basic_salary: payroll.basic_salary,
                allowances,
                total_allowances: payroll.total_allowances,
                gross_salary: payroll.gross_salary
            },

            deductions: {
                items: deductions,
                total_deductions: payroll.total_deductions
            },

            net_salary: payroll.net_salary,

            payment: {
                id: payment.id,
                amount: payment.amount,
                payment_method: payment.payment_method,
                payment_reference: payment.payment_reference,
                payment_status: payment.payment_status,
                paid_at: payment.paid_at,
                processed_by: payment.processed_by,
                processed_by_name: payment.processed_by_name
            },

            generated_by: payslip.generated_by,

            already_existed: !inserted
        };

    } catch (error) {
        await client.query('ROLLBACK');

        throw error;

    } finally {
        client.release();
    }
};


/**
 * Get a payslip by ID.
 */
const getPayslipById = async (payslipId) => {
    const client = await pool.connect();

    try {
        const payslipResult = await client.query(
            `
            SELECT
                p.id,
                p.payroll_record_id,
                p.user_id,
                p.payslip_number,
                p.issued_at,
                p.generated_by,

                u.first_name,
                u.last_name,
                u.email,
                u.phone,
                u.role,

                pp.id AS payroll_period_id,
                pp.period_name,
                pp.start_date,
                pp.end_date,
                pp.payment_date,

                pr.basic_salary,
                pr.total_allowances,
                pr.total_deductions,
                pr.gross_salary,
                pr.net_salary,
                pr.status AS payroll_status,

                generator.first_name || ' ' || generator.last_name
                    AS generated_by_name

            FROM payslips p

            INNER JOIN users u
                ON u.id = p.user_id

            INNER JOIN payroll_records pr
                ON pr.id = p.payroll_record_id

            INNER JOIN payroll_periods pp
                ON pp.id = pr.payroll_period_id

            LEFT JOIN users generator
                ON generator.id = p.generated_by

            WHERE p.id = $1
            `,
            [payslipId]
        );

        if (payslipResult.rowCount === 0) {
            const error = new Error(
                'Payslip not found'
            );

            error.statusCode = 404;

            throw error;
        }

        const payslip = payslipResult.rows[0];

        const items = await getPayrollItems(
            client,
            payslip.payroll_record_id
        );

        const payment = await getPayrollPayment(
            client,
            payslip.payroll_record_id
        );

        return {
            id: payslip.id,
            payroll_record_id: payslip.payroll_record_id,
            user_id: payslip.user_id,

            payslip_number: payslip.payslip_number,
            issued_at: payslip.issued_at,

            employee: {
                first_name: payslip.first_name,
                last_name: payslip.last_name,
                email: payslip.email,
                phone: payslip.phone,
                role: payslip.role
            },

            payroll_period: {
                id: payslip.payroll_period_id,
                period_name: payslip.period_name,
                start_date: payslip.start_date,
                end_date: payslip.end_date,
                payment_date: payslip.payment_date
            },

            earnings: {
                basic_salary: payslip.basic_salary,

                allowances: items.filter(
                    item => item.item_type === 'allowance'
                ),

                total_allowances: payslip.total_allowances,

                gross_salary: payslip.gross_salary
            },

            deductions: {
                items: items.filter(
                    item => item.item_type === 'deduction'
                ),

                total_deductions: payslip.total_deductions
            },

            net_salary: payslip.net_salary,

            payment,

            generated_by: payslip.generated_by,
            generated_by_name: payslip.generated_by_name
        };

    } finally {
        client.release();
    }
};


/**
 * Get a payslip using a payroll record ID.
 */
const getPayslipByPayrollRecord = async (
    payrollRecordId
) => {
    const result = await pool.query(
        `
        SELECT
            p.id,
            p.payroll_record_id,
            p.user_id,
            p.payslip_number,
            p.issued_at,
            p.generated_by,

            generator.first_name || ' ' || generator.last_name
                AS generated_by_name

        FROM payslips p

        LEFT JOIN users generator
            ON generator.id = p.generated_by

        WHERE p.payroll_record_id = $1
        `,
        [payrollRecordId]
    );

    if (result.rowCount === 0) {
        const error = new Error(
            'Payslip not found for this payroll record'
        );

        error.statusCode = 404;

        throw error;
    }

    return getPayslipById(result.rows[0].id);
};


module.exports = {
    generatePayslip,
    getPayslipById,
    getPayslipByPayrollRecord
};