// ============================================================
// Monitor Manager
// Detects all connected displays and creates one frameless,
// transparent, always-on-top island window per monitor.
// Has a watchdog timer to auto-heal blank/crashed windows.
// ============================================================

const { BrowserWindow, screen } = require('electron');
const path = require('path');

const ISLAND_WIDTH = 380;
const ISLAND_HEIGHT = 220;

// How often to check that all windows are alive and visible (ms)
const WATCHDOG_INTERVAL = 3000;

class MonitorManager {
  constructor(isDev) {
    this.isDev = isDev;
    this.windows = new Map(); // displayId → { win, isLoaded }
    this._watchdogTimer = null;
  }

  // ----------------------------------------------------------
  // Create one island window for each connected display
  // ----------------------------------------------------------
  createIslandWindows() {
    const displays = screen.getAllDisplays();
    for (const display of displays) {
      this._createWindowForDisplay(display);
    }
    // Start watchdog after all windows are created
    this._startWatchdog();
  }

  // ----------------------------------------------------------
  // Tear down all windows and recreate from scratch.
  // ----------------------------------------------------------
  rebuildWindows() {
    this._stopWatchdog();
    for (const [, entry] of this.windows) {
      if (!entry.win.isDestroyed()) entry.win.close();
    }
    this.windows.clear();
    this.createIslandWindows();
  }

  // ----------------------------------------------------------
  // Reposition all existing windows (e.g. resolution changed)
  // ----------------------------------------------------------
  repositionAll() {
    const displays = screen.getAllDisplays();
    const displayMap = new Map(displays.map((d) => [d.id, d]));
    for (const [id, entry] of this.windows) {
      const display = displayMap.get(id);
      if (display && !entry.win.isDestroyed()) {
        const pos = this._calcPosition(display);
        entry.win.setBounds({ x: pos.x, y: pos.y, width: ISLAND_WIDTH, height: ISLAND_HEIGHT });
      }
    }
  }

  // ----------------------------------------------------------
  // Broadcast an IPC message to all island windows
  // ----------------------------------------------------------
  broadcastToAll(channel, data) {
    for (const [, entry] of this.windows) {
      if (!entry.win.isDestroyed() && entry.win.webContents && entry.isLoaded) {
        entry.win.webContents.send(channel, data);
      }
    }
  }

  // ----------------------------------------------------------
  // Toggle visibility of all islands
  // ----------------------------------------------------------
  toggleVisibility() {
    for (const [, entry] of this.windows) {
      if (!entry.win.isDestroyed()) {
        if (entry.win.isVisible()) entry.win.hide();
        else entry.win.show();
      }
    }
  }

  // ----------------------------------------------------------
  // Watchdog: every WATCHDOG_INTERVAL ms, check all windows
  // are alive and visible. Reload or recreate if not.
  // ----------------------------------------------------------
  _startWatchdog() {
    this._watchdogTimer = setInterval(() => {
      const displays = screen.getAllDisplays();
      const displayMap = new Map(displays.map((d) => [d.id, d]));

      // Check each tracked window
      for (const [id, entry] of this.windows) {
        const { win } = entry;
        if (win.isDestroyed()) {
          // Window is gone — try to recreate
          const display = displayMap.get(id);
          if (display) {
            console.log(`[WinIsland][Watchdog] Window for display ${id} destroyed, recreating...`);
            this.windows.delete(id);
            this._createWindowForDisplay(display);
          }
        } else if (!win.isVisible()) {
          // Window exists but is hidden — show it
          console.log(`[WinIsland][Watchdog] Window for display ${id} hidden, showing...`);
          win.show();
        }
      }

      // Check if a display has no window (e.g. it was never created)
      for (const display of displays) {
        if (!this.windows.has(display.id)) {
          console.log(`[WinIsland][Watchdog] No window for display ${display.id}, creating...`);
          this._createWindowForDisplay(display);
        }
      }
    }, WATCHDOG_INTERVAL);
  }

  _stopWatchdog() {
    if (this._watchdogTimer) {
      clearInterval(this._watchdogTimer);
      this._watchdogTimer = null;
    }
  }

  // ----------------------------------------------------------
  // Internal: create a single island window on a given display
  // ----------------------------------------------------------
  _createWindowForDisplay(display) {
    const pos = this._calcPosition(display);

    const win = new BrowserWindow({
      x: pos.x,
      y: pos.y,
      width: ISLAND_WIDTH,
      height: ISLAND_HEIGHT,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      focusable: true,
      hasShadow: false,
      roundedCorners: true,
      show: false, // Don't show until content is loaded
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    const entry = { win, isLoaded: false };
    this.windows.set(display.id, entry);

    const loadContent = () => {
      if (win.isDestroyed()) return;
      const config = require('../config.json');
      const devPort = config.ports.devServer || 5173;
      entry.isLoaded = false;
      if (this.isDev) {
        win.loadURL(`http://localhost:${devPort}`).catch(() => {
          setTimeout(() => loadContent(), 2000);
        });
      } else {
        win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
      }
    };

    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    loadContent();

    win.webContents.on('did-finish-load', () => {
      entry.isLoaded = true;
      win.setIgnoreMouseEvents(true, { forward: true });
      win.show(); // Now show the window
    });

    // Catch-all: if load fails, retry
    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      if (errorCode === -3) return; // Aborted (normal during reload)
      console.log(`[WinIsland] Load failed (${errorCode}: ${errorDescription}), retrying in 2s...`);
      entry.isLoaded = false;
      setTimeout(() => loadContent(), 2000);
    });

    // Renderer process crashed — reload immediately
    win.webContents.on('render-process-gone', (event, details) => {
      console.log(`[WinIsland] Renderer crashed (${details.reason}), reloading...`);
      entry.isLoaded = false;
      setTimeout(() => {
        if (!win.isDestroyed()) loadContent();
      }, 500);
    });

    // Window became unresponsive — reload after short delay
    win.webContents.on('unresponsive', () => {
      console.log('[WinIsland] Window unresponsive, reloading...');
      setTimeout(() => {
        if (!win.isDestroyed()) win.reload();
      }, 1500);
    });

    win.webContents.on('responsive', () => {
      if (!win.isDestroyed()) {
        win.setIgnoreMouseEvents(true, { forward: true });
      }
    });

    // Window was closed — remove from map (watchdog will recreate if display still exists)
    win.on('closed', () => {
      this.windows.delete(display.id);
    });
  }

  // ----------------------------------------------------------
  // Calculate the centered-top position for a given display
  // ----------------------------------------------------------
  _calcPosition(display) {
    const { x, y, width } = display.workArea;
    return {
      x: Math.round(x + (width - ISLAND_WIDTH) / 2),
      y: y,
    };
  }
}

module.exports = MonitorManager;
