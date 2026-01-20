const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const auditLog = require('../middleware/auditLog');

// Public routes
router.post('/register', auditLog('register', 'user'), authController.register);
router.post('/login', auditLog('login', 'user'), authController.login);

// Protected routes
router.get('/profile', authenticate, authController.getProfile);

module.exports = router;
