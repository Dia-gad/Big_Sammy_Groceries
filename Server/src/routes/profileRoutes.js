const express = require('express');

const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');

const {
    updateProfileValidator,
    changePasswordValidator
} = require('../validators/profileValidator');

const {
    getMyProfile,
    updateMyProfile,
    changeMyPassword
} = require('../controllers/profileController');

const router = express.Router();


// GET MY PROFILE
router.get(
    '/',
    authenticate,
    getMyProfile
);


// UPDATE MY PROFILE
router.patch(
    '/',
    authenticate,
    updateProfileValidator,
    validate,
    updateMyProfile
);


// CHANGE PASSWORD
router.patch(
    '/password',
    authenticate,
    changePasswordValidator,
    validate,
    changeMyPassword
);


module.exports = router;