const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Admin dashboard
router.get('/admin', authorize('admin', 'auditor'), dashboardController.getAdminDashboard);

// Hospital dashboard
router.get('/hospital', authorize('hospital_admin', 'pharmacist', 'admin', 'auditor'), dashboardController.getHospitalDashboard);

// Warehouse dashboard
router.get('/warehouse', authorize('warehouse_manager', 'admin', 'auditor'), dashboardController.getWarehouseDashboard);

module.exports = router;
