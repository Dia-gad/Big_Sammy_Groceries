const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const registerUser = async ({
    first_name,
    last_name,
    email,
    phone,
    password,
}) => {
    const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
    );

    if (existingUser.rows.length > 0) {
        const error = new Error('Email is already registered');
        error.statusCode = 409;
        throw error;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await pool.query(
        `INSERT INTO users (
            first_name,
            last_name,
            email,
            phone,
            password
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, first_name, last_name, email, phone, role, created_at`,
        [
            first_name,
            last_name,
            email,
            phone || null,
            hashedPassword,
        ]
    );

    return result.rows[0];
};

const loginUser = async (email, password) => {
    const result = await pool.query(
        `SELECT id, first_name, last_name, email, phone, password, role
         FROM users
         WHERE email = $1`,
        [email]
    );

    if (result.rows.length === 0) {
        const error = new Error('Invalid email or password');
        error.statusCode = 401;
        throw error;
    }

    const user = result.rows[0];

    const passwordMatch = await bcrypt.compare(
        password,
        user.password
    );

    if (!passwordMatch) {
        const error = new Error('Invalid email or password');
        error.statusCode = 401;
        throw error;
    }

    const token = jwt.sign(
        {
            userId: user.id,
            role: user.role,
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || '7d',
        }
    );

    delete user.password;

    return {
        user,
        token,
    };
};

module.exports = {
    registerUser,
    loginUser,
};