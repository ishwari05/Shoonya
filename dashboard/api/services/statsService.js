const store = require('../data/store');

class StatsService {
  async getStats() {
    const events = store.events;
    const totalDetected = events.length;
    const redacted = events.filter(e => e.action === 'REDACTED').length;
    const preventionRate = totalDetected > 0 ? (redacted / totalDetected) * 100 : 0;
    
    const totalRisk = events.reduce((acc, e) => acc + (e.risk_score || 0), 0);
    const avgRisk = totalDetected > 0 ? Math.round(totalRisk / totalDetected) : 0;

    return {
      totalDetected,
      secretsBlocked: redacted,
      preventionRate: Math.round(preventionRate),
      avgRisk
    };
  }

  async getInsights() {
    const events = store.events;
    const last2Hours = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const recentEvents = events.filter(e => new Date(e.timestamp) >= last2Hours).length;
    
    const insights = [];
    if (recentEvents > 5) {
      insights.push({
        priority: 'high',
        message: `Spike in activity detected: ${recentEvents} events in the last 2 hours.`
      });
    }

    const platformExposure = events.reduce((acc, e) => {
      acc[e.platform] = (acc[e.platform] || 0) + 1;
      return acc;
    }, {});
    
    const sortedPlatforms = Object.entries(platformExposure).sort((a, b) => b[1] - a[1]);
    const topPlatform = sortedPlatforms[0];

    if (topPlatform && topPlatform[1] > 10) {
      insights.push({
        priority: 'medium',
        message: `Repeated leaks detected on ${topPlatform[0]}. Consider reviewing platform-specific policies.`
      });
    }

    if (insights.length === 0) {
      insights.push({
        priority: 'low',
        message: 'Security landscape is currently stable. No significant anomalies detected.'
      });
    }

    return insights;
  }
}

module.exports = new StatsService();
