// ============================================================
// Calendar Manager (v2 — Pure Local)
// Manages island-specific events stored in a local JSON file.
// ============================================================

const { app } = require('electron');
const fs = require('fs');
const path = require('path');

class CalendarManager {
  constructor() {
    this.userDataPath = app.getPath('userData');
    this.eventsPath = path.join(this.userDataPath, 'island_events.json');
    this.events = [];
    this.pollTimer = null;
    this.callback = null;

    // Ensure the events file exists
    this._ensureEventsFile();
    this._loadEvents();
  }

  // ----------------------------------------------------------
  // Initialization & Loading
  // ----------------------------------------------------------
  _ensureEventsFile() {
    if (!fs.existsSync(this.eventsPath)) {
      const initialData = [
        {
          id: 'welcome-1',
          title: 'Welcome to WinIsland!',
          start: new Date().toISOString(),
          end: new Date(Date.now() + 3600000).toISOString(),
          location: 'Your Desktop',
          isAllDay: false
        }
      ];
      try {
        fs.writeFileSync(this.eventsPath, JSON.stringify(initialData, null, 2), 'utf8');
      } catch (err) {
        console.error('Failed to create island_events.json:', err);
      }
    }
  }

  _loadEvents() {
    try {
      const data = fs.readFileSync(this.eventsPath, 'utf8');
      this.events = JSON.parse(data);
    } catch (err) {
      console.error('Failed to load island_events.json:', err);
      this.events = [];
    }
  }

  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------
  startPolling(callback) {
    this.callback = callback;
    
    const poll = () => {
      this._loadEvents();
      if (this.callback) this.callback(this.events);
    };

    // Initial load
    poll();
    // Refresh every 5 minutes (local file doesn't change on its own unless user edits)
    this.pollTimer = setInterval(poll, 300000); 
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  getEvents() {
    return this.events;
  }

  // Add/Remove events (for future UI expansion)
  async saveEvent(event) {
    this.events.push({
      id: Date.now().toString(),
      ...event
    });
    this._persist();
    if (this.callback) this.callback(this.events);
  }

  _persist() {
    try {
      fs.writeFileSync(this.eventsPath, JSON.stringify(this.events, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to save island_events.json:', err);
    }
  }
}

module.exports = CalendarManager;
