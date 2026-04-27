const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

router.get('/login-history', authMiddleware, adminMiddleware, adminController.getLoginHistory);

module.exports = router;
