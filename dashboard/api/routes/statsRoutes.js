const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const { authMiddleware } = require('../middleware/auth');

router.get('/stats', authMiddleware, statsController.getStats);
router.get('/insights', authMiddleware, statsController.getInsights);

module.exports = router;
