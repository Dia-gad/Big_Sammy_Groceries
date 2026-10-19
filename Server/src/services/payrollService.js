const pool = require('../config/database');


/**
 * Allowed staff roles for payroll.
 *
 * Customers are deliberately excluded.
 */
const PAYROLL_STAFF_ROLES = [
    'admin',
    'manager',
    'accountant',
    'inventory_staff',
    'rider'
];


/**
 * Validate that a user exists and is a staff member.
 */
const getStaffUser = async (client, userId) => {
    const result = await client.query(
        `
        SELECT
            id,
            first_name,
            last_name,
            email,
            phone,
            role,
            is_active
        FROM users
        WHERE id = $1
          AND role = ANY($2::text[])
        `,
        [userId, PAYROLL_STAFF_ROLES]
    );

    if (result.rowCount === 0) {
        const error = new Error(
            'Staff member not found'
        );

        error.statusCode = 404;

        throw error;
    }

    return result.rows[0];
};


/**
 * Create a salary structure for a staff member.
 *
 * This also supports:
 * - basic salary
 * - allowances
 * - deductions
 *
 * A transaction is used so the entire salary structure
 * is created successfully or nothing is saved.
 */
const createSalaryStructure = async ({
    userId,
    basicSalary,
    effectiveFrom,
    effectiveTo = null,
    notes = null,
    allowances = [],
    deductions = [],
    createdBy
}) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        /*
         * Confirm the staff member exists.
         */
        await getStaffUser(client, userId);


        /*
         * Only one active salary structure should exist
         * for a staff member at a given time.
         */
        if (!effectiveTo) {
            const activeStructure = await client.query(
                `
                SELECT id
                FROM staff_salary_structures
                WHERE user_id = $1
                  AND status = 'active'
                  AND (
                      effective_to IS NULL
                      OR effective_to >= $2::date
                  )
                LIMIT 1
                `,
                [
                    userId,
                    effectiveFrom
                ]
            );

            if (activeStructure.rowCount > 0) {
                const error = new Error(
                    'An active salary structure already exists for this staff member'
                );

                error.statusCode = 409;

                throw error;
            }
        }


        /*
         * Create salary structure.
         */
        const salaryResult = await client.query(
            `
            INSERT INTO staff_salary_structures (
                user_id,
                basic_salary,
                effective_from,
                effective_to,
                status,
                notes,
                created_by
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                'active',
                $5,
                $6
            )
            RETURNING *
            `,
            [
                userId,
                basicSalary,
                effectiveFrom,
                effectiveTo,
                notes,
                createdBy
            ]
        );

        const salaryStructure = salaryResult.rows[0];


        /*
         * Insert allowances.
         */
        for (const allowance of allowances) {
            await client.query(
                `
                INSERT INTO salary_allowances (
                    salary_structure_id,
                    allowance_name,
                    amount,
                    allowance_type
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4
                )
                `,
                [
                    salaryStructure.id,
                    allowance.name,
                    allowance.amount,
                    allowance.type || 'fixed'
                ]
            );
        }


        /*
         * Insert deductions.
         */
        for (const deduction of deductions) {
            await client.query(
                `
                INSERT INTO salary_deductions (
                    salary_structure_id,
                    deduction_name,
                    amount,
                    deduction_type
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4
                )
                `,
                [
                    salaryStructure.id,
                    deduction.name,
                    deduction.amount,
                    deduction.type || 'fixed'
                ]
            );
        }


        await client.query('COMMIT');


        return getSalaryStructureById(
            salaryStructure.id
        );

    } catch (error) {

        await client.query('ROLLBACK');

        throw error;

    } finally {

        client.release();
    }
};


/**
 * Get all salary structures.
 */
const getSalaryStructures = async ({
    status = null
} = {}) => {

    const values = [];

    let whereClause = '';

    if (status) {
        values.push(status);

        whereClause = `
            WHERE ss.status = $${values.length}
        `;
    }


    const result = await pool.query(
        `
        SELECT
            ss.id,
            ss.user_id,

            u.first_name,
            u.last_name,
            u.email,
            u.role,
            u.is_active,

            ss.basic_salary,
            ss.effective_from,
            ss.effective_to,
            ss.status,
            ss.notes,
            ss.created_by,
            ss.created_at,
            ss.updated_at

        FROM staff_salary_structures ss

        INNER JOIN users u
            ON u.id = ss.user_id

        ${whereClause}

        ORDER BY
            ss.created_at DESC
        `,
        values
    );


    return result.rows;
};


/**
 * Get one salary structure with allowances
 * and deductions.
 */
const getSalaryStructureById = async (salaryStructureId) => {

    const structureResult = await pool.query(
        `
        SELECT
            ss.id,
            ss.user_id,

            u.first_name,
            u.last_name,
            u.email,
            u.phone,
            u.role,
            u.is_active,

            ss.basic_salary,
            ss.effective_from,
            ss.effective_to,
            ss.status,
            ss.notes,
            ss.created_by,
            ss.created_at,
            ss.updated_at

        FROM staff_salary_structures ss

        INNER JOIN users u
            ON u.id = ss.user_id

        WHERE ss.id = $1
        `,
        [salaryStructureId]
    );


    if (structureResult.rowCount === 0) {
        const error = new Error(
            'Salary structure not found'
        );

        error.statusCode = 404;

        throw error;
    }


    const structure = structureResult.rows[0];


    const allowancesResult = await pool.query(
        `
        SELECT
            id,
            allowance_name,
            amount,
            allowance_type,
            created_at,
            updated_at

        FROM salary_allowances

        WHERE salary_structure_id = $1

        ORDER BY id ASC
        `,
        [salaryStructureId]
    );


    const deductionsResult = await pool.query(
        `
        SELECT
            id,
            deduction_name,
            amount,
            deduction_type,
            created_at,
            updated_at

        FROM salary_deductions

        WHERE salary_structure_id = $1

        ORDER BY id ASC
        `,
        [salaryStructureId]
    );


    return {
        ...structure,

        allowances: allowancesResult.rows,

        deductions: deductionsResult.rows
    };
};


/**
 * Get salary structures belonging to one staff member.
 */
const getStaffSalaryStructures = async (userId) => {

    const staff = await getStaffUser(
        pool,
        userId
    );


    const result = await pool.query(
        `
        SELECT
            ss.id,
            ss.user_id,
            ss.basic_salary,
            ss.effective_from,
            ss.effective_to,
            ss.status,
            ss.notes,
            ss.created_by,
            ss.created_at,
            ss.updated_at

        FROM staff_salary_structures ss

        WHERE ss.user_id = $1

        ORDER BY
            ss.effective_from DESC
        `,
        [userId]
    );


    return {
        staff,
        salaryStructures: result.rows
    };
};


/**
 * Deactivate a salary structure.
 *
 * Historical payroll records remain untouched.
 */
const deactivateSalaryStructure = async (
    salaryStructureId
) => {

    const result = await pool.query(
        `
        UPDATE staff_salary_structures

        SET
            status = 'inactive',
            effective_to = COALESCE(
                effective_to,
                CURRENT_DATE
            ),
            updated_at = CURRENT_TIMESTAMP

        WHERE id = $1
          AND status = 'active'

        RETURNING *
        `,
        [salaryStructureId]
    );


    if (result.rowCount === 0) {
        const error = new Error(
            'Active salary structure not found'
        );

        error.statusCode = 404;

        throw error;
    }


    return result.rows[0];
};


module.exports = {
    createSalaryStructure,
    getSalaryStructures,
    getSalaryStructureById,
    getStaffSalaryStructures,
    deactivateSalaryStructure
};