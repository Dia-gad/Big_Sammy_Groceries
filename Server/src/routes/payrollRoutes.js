const express = require('express');

const router = express.Router();

// ==================== MIDDLEWARE ====================

const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');

// ==================== SALARY VALIDATORS ====================

const {
    createSalaryStructureValidator,
    salaryStructureIdValidator,
    staffUserIdValidator,
    salaryStatusValidator
} = require('../validators/payrollValidator');

// ==================== SALARY CONTROLLERS ====================

const {
    createSalary,
    getSalaries,
    getSalary,
    getStaffSalaries,
    deactivateSalary
} = require('../controllers/payrollController');

// ==================== PAYROLL RUN VALIDATORS ====================

const {
    createPayrollPeriodValidator,
    payrollPeriodIdValidator,
    payrollPeriodStatusValidator
} = require('../validators/payrollRunValidator');

// ==================== PAYROLL RUN CONTROLLERS ====================

const {
    createPeriod,
    getPeriods,
    getPeriod,
    generate
} = require('../controllers/payrollRunController');

// ==================== PAYROLL APPROVAL VALIDATORS ====================

const {
    payrollApprovalPeriodIdValidator
} = require('../validators/payrollApprovalValidator');

// ==================== PAYROLL APPROVAL CONTROLLERS ====================

const {
    approve,
    getApprovalSummary
} = require('../controllers/payrollApprovalController');

// ==================== SALARY PAYMENT VALIDATORS ====================

const {
    createSalaryPaymentValidator,
    salaryPaymentIdValidator,
    payrollPaymentPeriodIdValidator
} = require('../validators/payrollPaymentValidator');

// ==================== SALARY PAYMENT CONTROLLERS ====================

const {
    createPayment,
    markPaid,
    getPayment,
    getPeriodPayments
} = require('../controllers/payrollPaymentController');

// ==================== PAYSLIP VALIDATORS ====================

const {
    payslipIdValidator,
    payrollRecordIdValidator
} = require('../validators/payrollPayslipValidator');

// ==================== PAYSLIP CONTROLLERS ====================

const {
    generate: generatePayslip,
    getPayslip,
    getByPayrollRecord
} = require('../controllers/payrollPayslipController');


// ============================================================
// SALARY STRUCTURES
// ============================================================

// Create salary structure
// POST /api/admin/payroll/salaries
router.post(
    '/salaries',
    authenticate,
    authorize('admin', 'accountant'),
    createSalaryStructureValidator,
    validate,
    createSalary
);

// Get all salary structures
// GET /api/admin/payroll/salaries
router.get(
    '/salaries',
    authenticate,
    authorize('admin', 'accountant'),
    getSalaries
);

// Get one salary structure
// GET /api/admin/payroll/salaries/:id
router.get(
    '/salaries/:id',
    authenticate,
    authorize('admin', 'accountant'),
    salaryStructureIdValidator,
    validate,
    getSalary
);

// Get salary structures for a staff member
// GET /api/admin/payroll/staff/:userId/salaries
router.get(
    '/staff/:userId/salaries',
    authenticate,
    authorize('admin', 'accountant'),
    staffUserIdValidator,
    validate,
    getStaffSalaries
);

// Deactivate salary structure
// PATCH /api/admin/payroll/salaries/:id/deactivate
router.patch(
    '/salaries/:id/deactivate',
    authenticate,
    authorize('admin', 'accountant'),
    salaryStatusValidator,
    validate,
    deactivateSalary
);


// ============================================================
// PAYROLL PERIODS
// ============================================================

// Create payroll period
// POST /api/admin/payroll/periods
router.post(
    '/periods',
    authenticate,
    authorize('admin', 'accountant'),
    createPayrollPeriodValidator,
    validate,
    createPeriod
);

// Get all payroll periods
// GET /api/admin/payroll/periods
router.get(
    '/periods',
    authenticate,
    authorize('admin', 'accountant'),
    getPeriods
);

// Get one payroll period
// GET /api/admin/payroll/periods/:id
router.get(
    '/periods/:id',
    authenticate,
    authorize('admin', 'accountant'),
    payrollPeriodIdValidator,
    validate,
    getPeriod
);


// ============================================================
// PAYROLL GENERATION
// ============================================================

// Generate payroll for a period
// POST /api/admin/payroll/periods/:id/generate
router.post(
    '/periods/:id/generate',
    authenticate,
    authorize('admin', 'accountant'),
    payrollPeriodIdValidator,
    validate,
    generate
);


// ============================================================
// PAYROLL APPROVAL
// ============================================================

// Approve payroll period
// PATCH /api/admin/payroll/periods/:id/approve
router.patch(
    '/periods/:id/approve',
    authenticate,
    authorize('admin', 'accountant'),
    payrollApprovalPeriodIdValidator,
    validate,
    approve
);

// Get payroll approval summary
// GET /api/admin/payroll/periods/:id/approval-summary
router.get(
    '/periods/:id/approval-summary',
    authenticate,
    authorize('admin', 'accountant'),
    payrollApprovalPeriodIdValidator,
    validate,
    getApprovalSummary
);


// ============================================================
// SALARY PAYMENTS
// ============================================================

// Create salary payment
// POST /api/admin/payroll/payments
router.post(
    '/payments',
    authenticate,
    authorize('admin', 'accountant'),
    createSalaryPaymentValidator,
    validate,
    createPayment
);

// Mark salary payment as paid
// PATCH /api/admin/payroll/payments/:id/pay
router.patch(
    '/payments/:id/pay',
    authenticate,
    authorize('admin', 'accountant'),
    salaryPaymentIdValidator,
    validate,
    markPaid
);

// Get salary payment by ID
// GET /api/admin/payroll/payments/:id
router.get(
    '/payments/:id',
    authenticate,
    authorize('admin', 'accountant'),
    salaryPaymentIdValidator,
    validate,
    getPayment
);

// Get all payments for payroll period
// GET /api/admin/payroll/periods/:id/payments
router.get(
    '/periods/:id/payments',
    authenticate,
    authorize('admin', 'accountant'),
    payrollPaymentPeriodIdValidator,
    validate,
    getPeriodPayments
);


// ============================================================
// PAYSLIPS
// IMPORTANT:
// The payroll-record routes MUST come before /payslips/:id
// ============================================================

// Generate payslip for a payroll record
// POST /api/admin/payroll/payslips/payroll-record/:payrollRecordId
router.post(
    '/payslips/payroll-record/:payrollRecordId',
    authenticate,
    authorize('admin', 'accountant'),
    payrollRecordIdValidator,
    validate,
    generatePayslip
);

// Get payslip by payroll record
// GET /api/admin/payroll/payslips/payroll-record/:payrollRecordId
router.get(
    '/payslips/payroll-record/:payrollRecordId',
    authenticate,
    authorize('admin', 'accountant'),
    payrollRecordIdValidator,
    validate,
    getByPayrollRecord
);

// Get payslip by payslip ID
// GET /api/admin/payroll/payslips/:id
router.get(
    '/payslips/:id',
    authenticate,
    authorize('admin', 'accountant'),
    payslipIdValidator,
    validate,
    getPayslip
);


// ============================================================
// EXPORT ROUTER
// ============================================================

module.exports = router;