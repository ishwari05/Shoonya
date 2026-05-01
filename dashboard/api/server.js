require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Event = require('./models/Event');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/shoonya')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.post('/log-event', async (req, res) => {
  try {
    const { type, platform, risk_score, action, timestamp, details } = req.body;
    const newEvent = new Event({
      type,
      platform,
      risk_score,
      action,
      timestamp: timestamp || new Date(),
      details
    });
    await newEvent.save();
    res.status(201).json({ success: true, data: newEvent });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/stats', async (req, res) => {
  try {
    const totalDetected = await Event.countDocuments();
    const redacted = await Event.countDocuments({ action: 'REDACTED' });
    const preventionRate = totalDetected > 0 ? (redacted / totalDetected) * 100 : 0;

    const riskLevels = await Event.aggregate([
      { $group: { _id: null, avgRisk: { $avg: "$risk_score" } } }
    ]);
    const avgRisk = riskLevels.length > 0 ? Math.round(riskLevels[0].avgRisk) : 0;

    res.json({
      success: true,
      data: {
        totalDetected,
        secretsBlocked: redacted,
        preventionRate: Math.round(preventionRate),
        avgRisk
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/events', async (req, res) => {
  try {
    const events = await Event.find().sort({ timestamp: -1 }).limit(100);
    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/insights', async (req, res) => {
  try {
    const last2Hours = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const recentEvents = await Event.countDocuments({ timestamp: { $gte: last2Hours } });
    
    const insights = [];
    if (recentEvents > 5) {
      insights.push({
        priority: 'high',
        message: `Spike in activity detected: ${recentEvents} events in the last 2 hours.`
      });
    }

    const platformExposure = await Event.aggregate([
      { $group: { _id: "$platform", count: { $sum: 1 } } }
    ]);
    
    const topPlatform = platformExposure.sort((a, b) => b.count - a.count)[0];
    if (topPlatform && topPlatform.count > 10) {
      insights.push({
        priority: 'medium',
        message: `Repeated leaks detected on ${topPlatform._id}. Consider reviewing platform-specific policies.`
      });
    }

    if (insights.length === 0) {
      insights.push({
        priority: 'low',
        message: 'Security landscape is currently stable. No significant anomalies detected.'
      });
    }

    res.json({ success: true, data: insights });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
