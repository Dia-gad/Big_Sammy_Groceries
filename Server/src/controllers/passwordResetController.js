const {
    requestPasswordReset,
    resetPassword,
} = require('../services/passwordResetService');

const {
    sendPasswordResetEmail,
} = require('../services/emailService');

const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;

        const result = await requestPasswordReset(email);

        /*
         * Do not reveal whether the email exists.
         */
        if (result.resetToken) {
            try {
                await sendPasswordResetEmail({
                    email: result.email,
                    firstName: result.firstName,
                    resetToken: result.resetToken,
                });
            } catch (emailError) {
                console.error(
                    '[Password Reset Email Error]',
                    emailError.message
                );

                return res.status(500).json({
                    success: false,
                    message:
                        'Unable to send password reset email. Please try again later.',
                });
            }
        }

        return res.status(200).json({
            success: true,
            message:
                'If an account exists with that email, a password reset link has been sent.',
        });
    } catch (error) {
        next(error);
    }
};

const resetPasswordHandler = async (req, res, next) => {
    try {
        const {
            token,
            new_password,
        } = req.body;

        const result = await resetPassword(
            token,
            new_password
        );

        return res.status(200).json({
            success: true,
            message:
                'Password reset successful. You can now log in with your new password.',
            data: {
                email: result.email,
            },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    forgotPassword,
    resetPasswordHandler,
};