const store = require('../data/store');

class AdminService {
  async getLoginHistory(limit = 100) {
    return store.loginHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
  }
}

module.exports = new AdminService();
