const store = require('../data/store');

class AuthService {
  async findUserByEmail(email) {
    return store.users.find(u => u.email === email);
  }

  async recordLogin(userId, email, ipAddress, userAgent) {
    const log = {
      id: Date.now(),
      userId,
      email,
      ipAddress,
      userAgent,
      timestamp: new Date().toISOString()
    };
    store.loginHistory.push(log);
    return log;
  }
}

module.exports = new AuthService();
