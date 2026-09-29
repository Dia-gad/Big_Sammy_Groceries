const {
    registerUser,
    loginUser,
} = require('../services/authService');

const register = async (req, res, next) => {
    try {
        const user = await registerUser(req.body);

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            data: user,
        });
    } catch (error) {
        next(error);
    }
};

const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        const result = await loginUser(email, password);

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

const logout = async (req, res, next) => {
    try {
        res.status(200).json({
            success: true,
            message: 'Logout successful',
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    register,
    login,
    logout,
};