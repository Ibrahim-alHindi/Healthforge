const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./authRoutes');
const drugRoutes = require('./drugRoutes');
const inventoryRoutes = require('./inventoryRoutes');
const alertRoutes = require('./alertRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const shipmentRoutes = require('./shipmentRoutes');
const consumptionRoutes = require('./consumptionRoutes');

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'HealthForge API'
  });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/drugs', drugRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/alerts', alertRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/shipments', shipmentRoutes);
router.use('/consumption', consumptionRoutes);

module.exports = router;
