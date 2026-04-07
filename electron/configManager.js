const fs = require('fs');
const path = require('path');

class ConfigManager {
  constructor() {
    this.configPath = path.join(process.cwd(), 'config.json');
    this.config = this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (err) {
      console.error('Error loading config.json:', err);
    }
    return { ports: { devServer: 9090 }, runAtStartup: false, startMinimized: true, startupDelaySeconds: 2 };
  }

  get(key, defaultValue) {
    return this.config[key] !== undefined ? this.config[key] : defaultValue;
  }

  set(key, value) {
    this.config[key] = value;
    this._save();
  }

  _save() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (err) {
      console.error('Error saving config.json:', err);
    }
  }
}

module.exports = new ConfigManager();
