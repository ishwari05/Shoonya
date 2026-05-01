const mongoose = require('mongoose');
const Event = require('./models/Event');

const MONGODB_URI = 'mongodb://localhost:27017/shoonya';

const types = ['API_KEY', 'PASSWORD', 'JWT_TOKEN', 'PRIVATE_KEY', 'OTHER'];
const platforms = ['ChatGPT', 'Claude', 'Gemini', 'GitHub'];
const actions = ['REDACTED', 'REDACTED', 'REDACTED', 'ALLOWED']; // 75% redacted

const seed = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB for seeding...');

    // Clear existing
    await Event.deleteMany({});

    const events = [];
    const now = new Date();

    for (let i = 0; i < 50; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        const platform = platforms[Math.floor(Math.random() * platforms.length)];
        const action = actions[Math.floor(Math.random() * actions.length)];
        
        let risk_score;
        if (type === 'API_KEY' || type === 'PRIVATE_KEY') risk_score = Math.floor(Math.random() * 20) + 80; // 80-100
        else if (type === 'PASSWORD') risk_score = Math.floor(Math.random() * 30) + 50; // 50-80
        else risk_score = Math.floor(Math.random() * 50); // 0-50

        const timestamp = new Date(now.getTime() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)); // Last 30 days

        events.push({
            type,
            platform,
            risk_score,
            action,
            timestamp,
            details: `Mock detection of ${type} on ${platform}`
        });
    }

    await Event.insertMany(events);
    console.log('✅ Mock data seeded successfully!');
    process.exit();
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seed();
