const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authenticate, authorize } = require('../middleware/auth');
const auditLog = require('../middleware/auditLog');

// All routes require authentication
router.use(authenticate);

// Get inventory
router.get('/', inventoryController.getInventory);

// Get inventory summary
router.get('/summary', inventoryController.getInventorySummary);

// Stock operations (warehouse managers and hospital admins)
router.post('/stock-in', 
  authorize('admin', 'warehouse_manager', 'hospital_admin'), 
  auditLog('stock_in', 'inventory'), 
  inventoryController.stockIn
);

router.post('/stock-out', 
  authorize('admin', 'warehouse_manager', 'hospital_admin', 'pharmacist'), 
  auditLog('stock_out', 'inventory'), 
  inventoryController.stockOut
);

router.post('/transfer', 
  authorize('admin', 'warehouse_manager', 'hospital_admin'), 
  auditLog('transfer', 'inventory'), 
  inventoryController.transfer
);

module.exports = router;
