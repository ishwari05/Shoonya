const bcrypt = require('bcryptjs');

// Mock Data Store to act as an in-memory database
const store = {
  users: [
    {
      id: 1,
      email: 'admin@shoonya.com',
      // Hashed password for 'password123'
      password: bcrypt.hashSync('password123', 10),
      role: 'admin'
    }
  ],
  events: [
    {
      id: 1,
      type: 'api_key',
      platform: 'ChatGPT',
      risk_score: 85,
      action: 'REDACTED',
      timestamp: new Date().toISOString(),
      details: 'Detected OpenAI API Key'
    },
    {
      id: 2,
      type: 'password',
      platform: 'Claude',
      risk_score: 95,
      action: 'REDACTED',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      details: 'Detected hardcoded password'
    }
  ],
  loginHistory: []
};

module.exports = store;
