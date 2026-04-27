const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const POLL_INTERVAL = 2000; // Poll every 2 seconds for privacy indicators

const PS_SCRIPT_DIR = path.join(require('os').tmpdir(), 'dynamic_island_scripts');

function ensureScriptDir() {
  if (!fs.existsSync(PS_SCRIPT_DIR)) {
    fs.mkdirSync(PS_SCRIPT_DIR, { recursive: true });
  }
}

const PRIVACY_SCRIPT_CONTENT = `
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$cameraApps = Get-ChildItem -Path "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\webcam" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.GetValue('LastUsedTimeStop') -eq 0 }

$micApps = Get-ChildItem -Path "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.GetValue('LastUsedTimeStop') -eq 0 }

$results = @()

foreach ($app in $cameraApps) {
    $results += [PSCustomObject]@{
        type = "camera"
        app = $app.PSChildName
        timeStart = $app.GetValue('LastUsedTimeStart')
    }
}

foreach ($app in $micApps) {
    $results += [PSCustomObject]@{
        type = "microphone"
        app = $app.PSChildName
        timeStart = $app.GetValue('LastUsedTimeStart')
    }
}

$results | ConvertTo-Json -Compress
`;

class PrivacyManager {
  constructor() {
    this.currentState = { camera: [], microphone: [] };
    this.pollTimer = null;
    this.enabled = true; // Controlled by UI toggle
    this._scriptPath = null;
    this._initScript();
  }

  _initScript() {
    ensureScriptDir();
    const scriptPath = path.join(PS_SCRIPT_DIR, 'privacy_query.ps1');
    fs.writeFileSync(scriptPath, PRIVACY_SCRIPT_CONTENT, 'utf8');
    this._scriptPath = scriptPath;
  }

  startPolling(callback) {
    this.callback = callback;
    
    const poll = () => {
      if (!this.enabled) {
        if (this.currentState.camera.length > 0 || this.currentState.microphone.length > 0) {
          this.currentState = { camera: [], microphone: [] };
          if (this.callback) this.callback(this.currentState);
        }
        return;
      }

      this._queryPrivacy()
        .then((state) => {
          // Check if state changed before invoking callback
          const prevCam = JSON.stringify(this.currentState.camera);
          const prevMic = JSON.stringify(this.currentState.microphone);
          const currCam = JSON.stringify(state.camera);
          const currMic = JSON.stringify(state.microphone);

          if (prevCam !== currCam || prevMic !== currMic) {
            this.currentState = state;
            if (this.callback) this.callback(state);
          }
        })
        .catch(() => {
          // Ignore errors during query
        });
    };

    poll();
    this.pollTimer = setInterval(poll, POLL_INTERVAL);
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  getCurrentState() {
    return this.currentState;
  }
  
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.currentState = { camera: [], microphone: [] };
      if (this.callback) this.callback(this.currentState);
    }
  }

  _formatAppName(rawName) {
    if (!rawName) return "Unknown";
    
    // NonPackaged apps look like C:#Program Files#...#app.exe
    if (rawName.includes('#')) {
      const parts = rawName.split('#');
      const filename = parts[parts.length - 1];
      let name = filename.replace('.exe', '');
      
      // Map some common executable names to better display names
      const knownApps = {
        'msedge': 'Microsoft Edge',
        'chrome': 'Google Chrome',
        'firefox': 'Firefox',
        'brave': 'Brave',
        'obs64': 'OBS Studio',
        'obs32': 'OBS Studio',
        'discord': 'Discord',
        'zoom': 'Zoom'
      };
      
      return knownApps[name.toLowerCase()] || (name.charAt(0).toUpperCase() + name.slice(1));
    }
    
    // Packaged apps (UWP)
    return rawName.split('_')[0];
  }

  _queryPrivacy() {
    return new Promise((resolve, reject) => {
      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', this._scriptPath],
        { timeout: 3000 },
        (err, stdout) => {
          if (err) return reject(err);
          if (!stdout || !stdout.trim()) {
            return resolve({ camera: [], microphone: [] });
          }
          
          try {
            const raw = stdout.trim();
            // Powershell might output empty, a single object, or an array
            let data = [];
            if (raw) {
               data = JSON.parse(raw);
               if (!Array.isArray(data)) data = [data];
            }

            const state = { camera: [], microphone: [] };
            
            data.forEach(item => {
              const fileTime = parseInt(item.timeStart, 10);
              const timestamp = (fileTime / 10000) - 11644473600000;
              
              const entry = {
                app: this._formatAppName(item.app),
                timestamp: timestamp
              };
              
              if (item.type === 'camera') {
                state.camera.push(entry);
              } else if (item.type === 'microphone') {
                state.microphone.push(entry);
              }
            });

            // Sort by most recent first
            state.camera.sort((a, b) => b.timestamp - a.timestamp);
            state.microphone.sort((a, b) => b.timestamp - a.timestamp);

            resolve(state);
          } catch (e) {
            reject(e);
          }
        }
      );
    });
  }
}

module.exports = PrivacyManager;
