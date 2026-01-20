const express = require('express');
const router = express.Router();
const alertsController = require('../controllers/alertsController');
const { authenticate, authorize } = require('../middleware/auth');
const auditLog = require('../middleware/auditLog');

// All routes require authentication
router.use(authenticate);

// Get alerts (role-filtered automatically)
router.get('/', alertsController.getAlerts);

// Acknowledge alert
router.patch('/:id/acknowledge', auditLog('acknowledge_alert', 'alert'), alertsController.acknowledgeAlert);

// Resolve alert
router.patch('/:id/resolve', auditLog('resolve_alert', 'alert'), alertsController.resolveAlert);

// Generate alerts (admin, warehouse managers, hospital admins)
router.post('/generate', 
  authorize('admin', 'warehouse_manager', 'hospital_admin'), 
  auditLog('generate_alerts', 'alert'), 
  alertsController.generateAlerts
);

module.exports = router;
