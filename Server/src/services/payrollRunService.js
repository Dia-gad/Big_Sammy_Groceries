const pool = require('../config/database');

/**
 * Create a new payroll period
 */
const createPayrollPeriod = async ({
    periodName,
    startDate,
    endDate,
    paymentDate,
    createdBy
}) => {
    const result = await pool.query(
        `INSERT INTO payroll_periods (
            period_name,
            start_date,
            end_date,
            payment_date,
            status,
            created_by
        )
        VALUES ($1, $2, $3, $4, 'draft', $5)
        RETURNING *`,
        [
            periodName,
            startDate,
            endDate,
            paymentDate || null,
            createdBy
        ]
    );

    return result.rows[0];
};


/**
 * Get all payroll periods
 */
const getPayrollPeriods = async ({ status } = {}) => {
    let query = `
        SELECT
            pp.id,
            pp.period_name,
            pp.start_date,
            pp.end_date,
            pp.payment_date,
            pp.status,
            pp.created_by,
            pp.approved_by,
            pp.approved_at,
            pp.created_at,
            pp.updated_at,

            creator.first_name || ' ' || creator.last_name AS created_by_name,

            approver.first_name || ' ' || approver.last_name AS approved_by_name,

            COUNT(pr.id)::INTEGER AS staff_count,

            COALESCE(
                SUM(pr.gross_salary),
                0
            ) AS total_gross_salary,

            COALESCE(
                SUM(pr.total_deductions),
                0
            ) AS total_deductions,

            COALESCE(
                SUM(pr.net_salary),
                0
            ) AS total_net_salary

        FROM payroll_periods pp

        LEFT JOIN users creator
            ON creator.id = pp.created_by

        LEFT JOIN users approver
            ON approver.id = pp.approved_by

        LEFT JOIN payroll_records pr
            ON pr.payroll_period_id = pp.id
            AND pr.status != 'cancelled'
    `;

    const values = [];

    if (status) {
        values.push(status);
        query += ` WHERE pp.status = $${values.length}`;
    }

    query += `
        GROUP BY
            pp.id,
            creator.first_name,
            creator.last_name,
            approver.first_name,
            approver.last_name

        ORDER BY pp.start_date DESC, pp.id DESC
    `;

    const result = await pool.query(query, values);

    return result.rows;
};


/**
 * Get a single payroll period
 */
const getPayrollPeriodById = async (periodId) => {
    const result = await pool.query(
        `
        SELECT
            pp.id,
            pp.period_name,
            pp.start_date,
            pp.end_date,
            pp.payment_date,
            pp.status,
            pp.created_by,
            pp.approved_by,
            pp.approved_at,
            pp.created_at,
            pp.updated_at,

            creator.first_name || ' ' || creator.last_name AS created_by_name,

            approver.first_name || ' ' || approver.last_name AS approved_by_name

        FROM payroll_periods pp

        LEFT JOIN users creator
            ON creator.id = pp.created_by

        LEFT JOIN users approver
            ON approver.id = pp.approved_by

        WHERE pp.id = $1
        `,
        [periodId]
    );

    if (result.rowCount === 0) {
        const error = new Error('Payroll period not found');
        error.statusCode = 404;
        throw error;
    }

    const period = result.rows[0];

    const recordsResult = await pool.query(
        `
        SELECT
            pr.id,
            pr.user_id,
            pr.salary_structure_id,

            u.first_name,
            u.last_name,
            u.email,
            u.role,

            pr.basic_salary,
            pr.total_allowances,
            pr.total_deductions,
            pr.gross_salary,
            pr.net_salary,
            pr.status,

            pr.created_at,
            pr.updated_at

        FROM payroll_records pr

        INNER JOIN users u
            ON u.id = pr.user_id

        WHERE pr.payroll_period_id = $1

        ORDER BY u.first_name ASC, u.last_name ASC
        `,
        [periodId]
    );

    return {
        ...period,
        records: recordsResult.rows
    };
};


/**
 * Calculate a payroll item.
 *
 * Fixed:
 *     amount = configured amount
 *
 * Percentage:
 *     amount = basic salary * percentage / 100
 */
const calculateItemAmount = ({
    amount,
    type,
    basicSalary
}) => {
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
        throw new Error('Invalid payroll item amount');
    }

    if (type === 'percentage') {
        return (basicSalary * numericAmount) / 100;
    }

    return numericAmount;
};


/**
 * Generate payroll for a payroll period
 */
const generatePayroll = async ({
    periodId,
    generatedBy
}) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        /*
         * Lock the payroll period while generation is happening.
         */
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

        if (period.status !== 'draft') {
            const error = new Error(
                `Payroll cannot be generated because the period is currently ${period.status}`
            );

            error.statusCode = 400;
            throw error;
        }

        /*
         * Find the latest active salary structure applicable
         * to each staff member during this payroll period.
         *
         * A salary structure is valid when:
         *
         * effective_from <= payroll end date
         *
         * AND
         *
         * effective_to IS NULL
         * OR effective_to >= payroll start date
         */
        const staffResult = await client.query(
            `
            SELECT DISTINCT ON (sss.user_id)
                sss.id AS salary_structure_id,
                sss.user_id,
                sss.basic_salary,
                sss.effective_from,
                sss.effective_to,

                u.first_name,
                u.last_name,
                u.email,
                u.role

            FROM staff_salary_structures sss

            INNER JOIN users u
                ON u.id = sss.user_id

            WHERE
                sss.status = 'active'

                AND sss.effective_from <= $1

                AND (
                    sss.effective_to IS NULL
                    OR sss.effective_to >= $2
                )

                AND u.is_active = TRUE

                AND u.role IN (
                    'admin',
                    'manager',
                    'accountant',
                    'inventory_staff',
                    'rider'
                )

            ORDER BY
                sss.user_id,
                sss.effective_from DESC,
                sss.id DESC
            `,
            [
                period.end_date,
                period.start_date
            ]
        );

        if (staffResult.rowCount === 0) {
            const error = new Error(
                'No active staff salary structures were found for this payroll period'
            );

            error.statusCode = 400;
            throw error;
        }

        /*
         * Prevent accidental duplicate generation.
         */
        const existingResult = await client.query(
            `
            SELECT COUNT(*)::INTEGER AS count
            FROM payroll_records
            WHERE payroll_period_id = $1
            `,
            [periodId]
        );

        if (Number(existingResult.rows[0].count) > 0) {
            const error = new Error(
                'Payroll has already been generated for this period'
            );

            error.statusCode = 400;
            throw error;
        }

        /*
         * Generate one payroll record per staff member.
         */
        for (const staff of staffResult.rows) {
            const basicSalary = Number(staff.basic_salary);

            /*
             * Get allowances
             */
            const allowancesResult = await client.query(
                `
                SELECT
                    allowance_name,
                    amount,
                    allowance_type
                FROM salary_allowances
                WHERE salary_structure_id = $1
                ORDER BY id ASC
                `,
                [staff.salary_structure_id]
            );

            /*
             * Get deductions
             */
            const deductionsResult = await client.query(
                `
                SELECT
                    deduction_name,
                    amount,
                    deduction_type
                FROM salary_deductions
                WHERE salary_structure_id = $1
                ORDER BY id ASC
                `,
                [staff.salary_structure_id]
            );

            let totalAllowances = 0;
            let totalDeductions = 0;

            const allowanceItems = [];
            const deductionItems = [];

            /*
             * Calculate allowances
             */
            for (const allowance of allowancesResult.rows) {
                const calculatedAmount = calculateItemAmount({
                    amount: allowance.amount,
                    type: allowance.allowance_type,
                    basicSalary
                });

                totalAllowances += calculatedAmount;

                allowanceItems.push({
                    name: allowance.allowance_name,
                    amount: calculatedAmount
                });
            }

            /*
             * Calculate deductions
             */
            for (const deduction of deductionsResult.rows) {
                const calculatedAmount = calculateItemAmount({
                    amount: deduction.amount,
                    type: deduction.deduction_type,
                    basicSalary
                });

                totalDeductions += calculatedAmount;

                deductionItems.push({
                    name: deduction.deduction_name,
                    amount: calculatedAmount
                });
            }

            const grossSalary =
                basicSalary + totalAllowances;

            const netSalary =
                grossSalary - totalDeductions;

            /*
             * Safety check.
             */
            if (netSalary < 0) {
                const error = new Error(
                    `Net salary cannot be negative for ${staff.first_name} ${staff.last_name}`
                );

                error.statusCode = 400;
                throw error;
            }

            /*
             * Create payroll record.
             */
            const payrollRecordResult = await client.query(
                `
                INSERT INTO payroll_records (
                    payroll_period_id,
                    user_id,
                    salary_structure_id,
                    basic_salary,
                    total_allowances,
                    total_deductions,
                    gross_salary,
                    net_salary,
                    status
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    'pending'
                )
                RETURNING *
                `,
                [
                    periodId,
                    staff.user_id,
                    staff.salary_structure_id,
                    basicSalary,
                    totalAllowances,
                    totalDeductions,
                    grossSalary,
                    netSalary
                ]
            );

            const payrollRecord = payrollRecordResult.rows[0];

            /*
             * Store allowance items.
             */
            for (const item of allowanceItems) {
                await client.query(
                    `
                    INSERT INTO payroll_items (
                        payroll_record_id,
                        item_type,
                        item_name,
                        amount
                    )
                    VALUES ($1, 'allowance', $2, $3)
                    `,
                    [
                        payrollRecord.id,
                        item.name,
                        item.amount
                    ]
                );
            }

            /*
             * Store deduction items.
             */
            for (const item of deductionItems) {
                await client.query(
                    `
                    INSERT INTO payroll_items (
                        payroll_record_id,
                        item_type,
                        item_name,
                        amount
                    )
                    VALUES ($1, 'deduction', $2, $3)
                    `,
                    [
                        payrollRecord.id,
                        item.name,
                        item.amount
                    ]
                );
            }
        }

        /*
         * Move period from draft → processing.
         */
        const updatedPeriodResult = await client.query(
            `
            UPDATE payroll_periods
            SET
                status = 'processing',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
            `,
            [periodId]
        );

        await client.query('COMMIT');

        return getPayrollPeriodById(updatedPeriodResult.rows[0].id);

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};


module.exports = {
    createPayrollPeriod,
    getPayrollPeriods,
    getPayrollPeriodById,
    generatePayroll
};