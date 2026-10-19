const {
    getProfile,
    updateProfile,
    changePassword
} = require('../services/profileService');


// ============================================================
// GET PROFILE
// ============================================================

const getMyProfile = async (req, res, next) => {
    try {
        const profile = await getProfile(
            req.user.userId
        );

        res.status(200).json({
            success: true,
            data: profile
        });

    } catch (error) {
        next(error);
    }
};


// ============================================================
// UPDATE PROFILE
// ============================================================

const updateMyProfile = async (req, res, next) => {
    try {
        const {
            first_name,
            last_name,
            phone
        } = req.body;

        const profile = await updateProfile({
            userId: req.user.userId,
            firstName: first_name,
            lastName: last_name,
            phone
        });

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: profile
        });

    } catch (error) {
        next(error);
    }
};


// ============================================================
// CHANGE PASSWORD
// ============================================================

const changeMyPassword = async (req, res, next) => {
    try {
        const {
            current_password,
            new_password
        } = req.body;

        await changePassword({
            userId: req.user.userId,
            currentPassword: current_password,
            newPassword: new_password
        });

        res.status(200).json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        next(error);
    }
};


module.exports = {
    getMyProfile,
    updateMyProfile,
    changeMyPassword
};