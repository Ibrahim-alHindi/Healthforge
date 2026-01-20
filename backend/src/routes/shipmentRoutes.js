const express = require('express');
const router = express.Router();
const shipmentController = require('../controllers/shipmentController');
const { authenticate, authorize } = require('../middleware/auth');
const auditLog = require('../middleware/auditLog');

// All routes require authentication
router.use(authenticate);

// Get shipments
router.get('/', shipmentController.getShipments);

// Get single shipment
router.get('/:id', shipmentController.getShipmentById);

// Update shipment status
router.patch('/:id/status', 
  authorize('admin', 'warehouse_manager', 'vendor'), 
  auditLog('update_shipment_status', 'shipment'), 
  shipmentController.updateShipmentStatus
);

module.exports = router;
