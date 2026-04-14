const { app } = require('electron');
const fs = require('fs');
const path = require('path');

class ConfigManager {
  constructor() {
    // 1. Determine paths
    // Persistent settings go to userData
    this.userDataPath = app.getPath('userData');
    this.configPath = path.join(this.userDataPath, 'config.json');

    // Default/Base config (for things like dev port)
    // In prod: look in the same folder as the exe
    // In dev: look in the process.cwd()
    this.baseConfigPath = app.isPackaged 
      ? path.join(path.dirname(app.getPath('exe')), 'config.json')
      : path.join(process.cwd(), 'config.json');

    // 2. Ensure userData directory exists
    if (!fs.existsSync(this.userDataPath)) {
      try {
        fs.mkdirSync(this.userDataPath, { recursive: true });
      } catch (err) {
        console.error('Error creating userData directory:', err);
      }
    }

    // 3. Load initial config
    this.config = this._load();
  }

  _load() {
    let defaults = { 
      ports: { devServer: 9090 }, 
      runAtStartup: false, 
      startMinimized: true, 
      startupDelaySeconds: 2,
      displayMode: 'pill', // 'pill' | 'attached'
      enableCalendarIntegration: false
    };

    // Try to load base config first (defaults)
    try {
      if (fs.existsSync(this.baseConfigPath)) {
        const data = fs.readFileSync(this.baseConfigPath, 'utf8');
        const baseConfig = JSON.parse(data);
        defaults = { ...defaults, ...baseConfig };
      }
    } catch (err) {
      // Base config might not exist in all environments, it's okay
      console.log('[ConfigManager] Base config not found or unreadable, using defaults.');
    }

    // Try to load user settings and override defaults
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        const userConfig = JSON.parse(data);
        return { ...defaults, ...userConfig };
      }
    } catch (err) {
      console.error('[ConfigManager] Error loading user config:', err);
    }

    return defaults;
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
      console.error('[ConfigManager] Error saving config.json:', err);
    }
  }
}

module.exports = new ConfigManager();
