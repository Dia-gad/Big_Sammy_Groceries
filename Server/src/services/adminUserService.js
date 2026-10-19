const bcrypt = require('bcrypt');
const pool = require('../config/database');


// =========================================================
// ALLOWED STAFF ROLES
// =========================================================

const STAFF_ROLES = [
    'admin',
    'manager',
    'accountant',
    'inventory_staff',
    'rider'
];


// =========================================================
// CREATE STAFF USER
// =========================================================

const createStaffUser = async ({
    firstName,
    lastName,
    email,
    phone = null,
    password,
    role,
    createdBy
}) => {

    if (!STAFF_ROLES.includes(role)) {
        const error = new Error(
            'Invalid staff role'
        );

        error.statusCode = 400;
        throw error;
    }

    // -----------------------------------------------------
    // Prevent an administrator from creating another
    // administrator unless the creator is an admin.
    // -----------------------------------------------------

    if (
        role === 'admin' &&
        createdBy.role !== 'admin'
    ) {
        const error = new Error(
            'Only an administrator can create another administrator'
        );

        error.statusCode = 403;
        throw error;
    }

    const normalizedEmail =
        email.trim().toLowerCase();

    // -----------------------------------------------------
    // Check duplicate email
    // -----------------------------------------------------

    const existingUser =
        await pool.query(
            `
            SELECT id
            FROM users
            WHERE email = $1
            `,
            [normalizedEmail]
        );

    if (existingUser.rowCount > 0) {
        const error = new Error(
            'A user with this email already exists'
        );

        error.statusCode = 409;
        throw error;
    }

    // -----------------------------------------------------
    // Hash password
    // -----------------------------------------------------

    const passwordHash =
        await bcrypt.hash(
            password,
            12
        );

    // -----------------------------------------------------
    // Create staff account
    // -----------------------------------------------------

    const result =
        await pool.query(
            `
            INSERT INTO users (
                first_name,
                last_name,
                email,
                phone,
                password,
                role
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6
            )
            RETURNING
                id,
                first_name,
                last_name,
                email,
                phone,
                role,
                created_at,
                updated_at
            `,
            [
                firstName.trim(),
                lastName.trim(),
                normalizedEmail,
                phone,
                passwordHash,
                role
            ]
        );

    return result.rows[0];
};


// =========================================================
// GET ALL STAFF
// =========================================================

const getStaffUsers = async () => {

    const result =
        await pool.query(
            `
            SELECT
                id,
                first_name,
                last_name,
                email,
                phone,
                role,
                created_at,
                updated_at
            FROM users
            WHERE role IN (
                'admin',
                'manager',
                'inventory_staff',
                'rider'
            )
            ORDER BY created_at DESC
            `
        );

    return result.rows;
};


// =========================================================
// GET SINGLE STAFF USER
// =========================================================

const getStaffUserById = async (
    userId
) => {

    const result =
        await pool.query(
            `
            SELECT
                id,
                first_name,
                last_name,
                email,
                phone,
                role,
                created_at,
                updated_at
            FROM users
            WHERE id = $1
              AND role IN (
                  'admin',
                  'manager',
                  'inventory_staff',
                  'rider'
              )
            `,
            [userId]
        );

    if (result.rowCount === 0) {
        const error = new Error(
            'Staff user not found'
        );

        error.statusCode = 404;
        throw error;
    }

    return result.rows[0];
};


// =========================================================
// CHANGE STAFF ROLE
// =========================================================

const changeStaffRole = async ({
    userId,
    role,
    changedBy
}) => {

    if (!STAFF_ROLES.includes(role)) {
        const error = new Error(
            'Invalid staff role'
        );

        error.statusCode = 400;
        throw error;
    }

    // -----------------------------------------------------
    // Only admins can assign the admin role.
    // -----------------------------------------------------

    if (
        role === 'admin' &&
        changedBy.role !== 'admin'
    ) {
        const error = new Error(
            'Only an administrator can assign the admin role'
        );

        error.statusCode = 403;
        throw error;
    }

    // -----------------------------------------------------
    // Prevent changing your own role.
    // -----------------------------------------------------

    if (
        Number(userId) ===
        Number(changedBy.userId)
    ) {
        const error = new Error(
            'You cannot change your own role'
        );

        error.statusCode = 400;
        throw error;
    }

    const result =
        await pool.query(
            `
            UPDATE users

            SET
                role = $1,
                updated_at =
                    CURRENT_TIMESTAMP

            WHERE id = $2
              AND role IN (
                  'admin',
                  'manager',
                  'inventory_staff',
                  'rider'
              )

            RETURNING
                id,
                first_name,
                last_name,
                email,
                phone,
                role,
                created_at,
                updated_at
            `,
            [
                role,
                userId
            ]
        );

    if (result.rowCount === 0) {
        const error = new Error(
            'Staff user not found'
        );

        error.statusCode = 404;
        throw error;
    }

    return result.rows[0];
};


// =========================================================
// DELETE / DEACTIVATE STAFF
//
// We do not physically delete staff records because they
// may be referenced by orders, inventory movements,
// refunds, deliveries, etc.
//
// For now, this operation changes the account back to
// customer only if the account is not protected.
//
// A proper is_active column will be introduced before
// this endpoint is exposed.
// =========================================================

const changeStaffStatus = async ({
    userId,
    isActive,
    changedBy
}) => {
    if (Number(userId) === Number(changedBy.userId)) {
        const error = new Error(
            'You cannot deactivate your own account'
        );
        error.statusCode = 400;
        throw error;
    }

    const result = await pool.query(
        `UPDATE users
         SET
            is_active = $1,
            updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
           AND role IN (
               'admin',
               'manager',
               'inventory_staff',
               'rider'
           )
         RETURNING
            id,
            first_name,
            last_name,
            email,
            phone,
            role,
            is_active,
            created_at,
            updated_at`,
        [isActive, userId]
    );

    if (result.rowCount === 0) {
        const error = new Error('Staff user not found');
        error.statusCode = 404;
        throw error;
    }

    return result.rows[0];
};

module.exports = {
    createStaffUser,
    getStaffUsers,
    getStaffUserById,
    changeStaffRole,
    changeStaffStatus
};