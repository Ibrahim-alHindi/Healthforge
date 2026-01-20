const express = require('express');
const router = express.Router();
const consumptionController = require('../controllers/consumptionController');
const { authenticate, authorize } = require('../middleware/auth');
const auditLog = require('../middleware/auditLog');

// All routes require authentication
router.use(authenticate);

// Log consumption (pharmacists and hospital admins)
router.post('/', 
  authorize('pharmacist', 'hospital_admin', 'admin'), 
  auditLog('log_consumption', 'consumption'), 
  consumptionController.logConsumption
);

// Get consumption logs
router.get('/', consumptionController.getConsumptionLogs);

// Get consumption summary
router.get('/summary', consumptionController.getConsumptionSummary);

module.exports = router;
