const express = require('express');

const {
    create,
    getAll,
    getOne,
    update,
    remove
} = require('../controllers/addressController');

const {
    createAddressValidator,
    updateAddressValidator
} = require('../validators/addressValidator');

const validate = require('../middleware/validate');
const authenticate = require('../middleware/auth');

const router = express.Router();

router.post(
    '/',
    authenticate,
    createAddressValidator,
    validate,
    create
);

router.get(
    '/',
    authenticate,
    getAll
);

router.get(
    '/:addressId',
    authenticate,
    getOne
);

router.put(
    '/:addressId',
    authenticate,
    updateAddressValidator,
    validate,
    update
);

router.delete(
    '/:addressId',
    authenticate,
    remove
);

module.exports = router;