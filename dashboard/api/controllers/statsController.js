const statsService = require('../services/statsService');

exports.getStats = async (req, res) => {
  try {
    const stats = await statsService.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getInsights = async (req, res) => {
  try {
    const insights = await statsService.getInsights();
    res.json({ success: true, data: insights });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
