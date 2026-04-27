const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const authService = require('../services/authService');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-shoonya';

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await authService.findUserByEmail(email);
    
    if (!user) {
      return res.status(400).json({ success: false, error: 'Invalid credentials' });
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '1d' });

    // Save login history
    await authService.recordLogin(user.id, user.email, req.ip, req.headers['user-agent']);

    res.json({ success: true, token, user: { email: user.email, role: user.role } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
