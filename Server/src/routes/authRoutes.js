const express = require('express');

const {
    register,
    login,
    logout,
} = require('../controllers/authController');

const {
    forgotPassword,
    resetPasswordHandler,
} = require('../controllers/passwordResetController');

const {
    registerValidator,
    loginValidator,
    forgotPasswordValidator,
    resetPasswordValidator,
} = require('../validators/authValidator');

const validate = require('../middleware/validate');

const router = express.Router();

router.post(
    '/register',
    registerValidator,
    validate,
    register
);

router.post(
    '/login',
    loginValidator,
    validate,
    login
);

router.post(
    '/forgot-password',
    forgotPasswordValidator,
    validate,
    forgotPassword
);

router.post(
    '/reset-password',
    resetPasswordValidator,
    validate,
    resetPasswordHandler
);

router.post('/logout', logout);

module.exports = router;