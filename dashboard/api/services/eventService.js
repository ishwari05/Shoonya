const store = require('../data/store');

class EventService {
  async getAllEvents(limit = 100) {
    return store.events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
  }

  async createEvent(eventData) {
    const newEvent = {
      id: Date.now(),
      timestamp: eventData.timestamp || new Date().toISOString(),
      ...eventData
    };
    store.events.push(newEvent);
    return newEvent;
  }
}

module.exports = new EventService();
