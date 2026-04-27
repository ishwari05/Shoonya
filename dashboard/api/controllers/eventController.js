const eventService = require('../services/eventService');

exports.logEvent = async (req, res) => {
  try {
    const { type, platform, risk_score, action, timestamp, details } = req.body;
    const newEvent = await eventService.createEvent({
      type, platform, risk_score, action, timestamp, details
    });
    res.status(201).json({ success: true, data: newEvent });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getEvents = async (req, res) => {
  try {
    const events = await eventService.getAllEvents(100);
    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
