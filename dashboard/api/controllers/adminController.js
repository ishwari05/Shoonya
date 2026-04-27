const adminService = require('../services/adminService');

exports.getLoginHistory = async (req, res) => {
  try {
    const history = await adminService.getLoginHistory(100);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
