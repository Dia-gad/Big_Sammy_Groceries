const express = require('express');

const {
    assignRiderToOrder
} = require('../controllers/deliveryController');

const {
    orderIdValidator,
    assignRiderValidator
} = require('../validators/deliveryValidator');

const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');

const router = express.Router();

router.post(
    '/:orderId/assign',
    authenticate,
    authorize('admin', 'manager'),
    orderIdValidator,
    assignRiderValidator,
    validate,
    assignRiderToOrder
);

module.exports = router;