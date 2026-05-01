const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { authMiddleware } = require('../middleware/auth');

router.post('/log-event', eventController.logEvent);
router.get('/events', authMiddleware, eventController.getEvents);

module.exports = router;
