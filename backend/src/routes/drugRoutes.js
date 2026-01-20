const express = require('express');
const router = express.Router();
const drugsController = require('../controllers/drugsController');
const { authenticate, authorize } = require('../middleware/auth');
const auditLog = require('../middleware/auditLog');

// All routes require authentication
router.use(authenticate);

// Get all drugs (any authenticated user)
router.get('/', drugsController.getDrugs);

// Get single drug
router.get('/:id', drugsController.getDrugById);

// Admin only routes
router.post('/', authorize('admin'), auditLog('create_drug', 'drug'), drugsController.createDrug);
router.patch('/:id', authorize('admin'), auditLog('update_drug', 'drug'), drugsController.updateDrug);
router.delete('/:id', authorize('admin'), auditLog('delete_drug', 'drug'), drugsController.deleteDrug);

module.exports = router;
