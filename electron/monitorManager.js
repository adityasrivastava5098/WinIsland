// ============================================================
// Monitor Manager
// Detects all connected displays and creates one frameless,
// transparent, always-on-top island window per monitor.
// Handles dynamic display changes (plug/unplug/resolution).
// ============================================================

const { BrowserWindow, screen } = require('electron');
const path = require('path');

// Island window dimensions — must be large enough for expanded state.
// Transparent regions are click-through so extra size doesn't block.
const ISLAND_WIDTH = 380;
const ISLAND_HEIGHT = 220;

class MonitorManager {
  constructor(isDev) {
    this.isDev = isDev;
    this.windows = new Map(); // displayId → BrowserWindow
  }

  // ----------------------------------------------------------
  // Create one island window for each connected display
  // ----------------------------------------------------------
  createIslandWindows() {
    const displays = screen.getAllDisplays();
    for (const display of displays) {
      this._createWindowForDisplay(display);
    }
  }

  // ----------------------------------------------------------
  // Tear down all windows and recreate from scratch.
  // Called when monitors are added/removed.
  // ----------------------------------------------------------
  rebuildWindows() {
    // Close all existing island windows
    for (const [id, win] of this.windows) {
      if (!win.isDestroyed()) {
        win.close();
      }
    }
    this.windows.clear();

    // Recreate for current display set
    this.createIslandWindows();
  }

  // ----------------------------------------------------------
  // Reposition all existing windows (e.g. resolution changed)
  // ----------------------------------------------------------
  repositionAll() {
    const displays = screen.getAllDisplays();
    const displayMap = new Map(displays.map((d) => [d.id, d]));

    for (const [id, win] of this.windows) {
      const display = displayMap.get(id);
      if (display && !win.isDestroyed()) {
        const pos = this._calcPosition(display);
        win.setBounds({ x: pos.x, y: pos.y, width: ISLAND_WIDTH, height: ISLAND_HEIGHT });
      }
    }
  }

  // ----------------------------------------------------------
  // Broadcast an IPC message to all island windows
  // ----------------------------------------------------------
  broadcastToAll(channel, data) {
    for (const [, win] of this.windows) {
      if (!win.isDestroyed() && win.webContents) {
        win.webContents.send(channel, data);
      }
    }
  }

  // ----------------------------------------------------------
  // Toggle visibility of all islands
  // ----------------------------------------------------------
  toggleVisibility() {
    for (const [, win] of this.windows) {
      if (!win.isDestroyed()) {
        if (win.isVisible()) {
          win.hide();
        } else {
          win.show();
        }
      }
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
      frame: false,              // no title bar
      transparent: true,         // transparent background
      alwaysOnTop: true,         // stay above everything
      skipTaskbar: true,         // don't show in taskbar
      resizable: false,
      focusable: true,           // allow interaction
      hasShadow: false,
      roundedCorners: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    // Keep always-on-top even over fullscreen apps
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    // Load the UI
    if (this.isDev) {
      win.loadURL('http://localhost:5173');
    } else {
      win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    }

    // Store reference keyed by display ID
    this.windows.set(display.id, win);

    // Cleanup reference on close
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
      y: y, // pinned to top edge
    };
  }
}

module.exports = MonitorManager;
