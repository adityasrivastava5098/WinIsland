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
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      focusable: true,
      hasShadow: false,
      roundedCorners: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        // Disable GPU at window level to reinforce app-level flags
        offscreen: false,
      },
    });

    const loadContent = () => {
      if (this.isDev) {
        win.loadURL('http://localhost:5173').catch(() => {
          // Retry after 2 seconds if Vite isn't ready yet
          setTimeout(() => loadContent(), 2000);
        });
      } else {
        win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
      }
    };

    // Keep always-on-top even over fullscreen apps
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    loadContent();

    // Default to click-through for transparent regions
    win.webContents.on('did-finish-load', () => {
      win.setIgnoreMouseEvents(true, { forward: true });
      // Ensure window is always visible after reload
      if (!win.isVisible()) win.show();
    });

    // ---- AUTO-RECOVERY: Reload on renderer crash ----
    // This is the key fix: when the GPU/renderer process crashes,
    // instead of going blank/invisible, the window reloads itself.
    win.webContents.on('render-process-gone', (event, details) => {
      console.log(`[WinIsland] Renderer crashed (${details.reason}), recovering...`);
      setTimeout(() => {
        if (!win.isDestroyed()) {
          loadContent();
        } else {
          // Window was destroyed, recreate it
          this._createWindowForDisplay(display);
        }
      }, 1000);
    });

    win.webContents.on('unresponsive', () => {
      console.log('[WinIsland] Window became unresponsive, reloading...');
      setTimeout(() => {
        if (!win.isDestroyed()) win.reload();
      }, 2000);
    });

    win.webContents.on('responsive', () => {
      if (!win.isDestroyed()) {
        win.setIgnoreMouseEvents(true, { forward: true });
      }
    });
    // --------------------------------------------------

    // Store reference keyed by display ID
    this.windows.set(display.id, win);

    // On close, don't just delete: attempt to recreate after a short delay
    win.on('closed', () => {
      this.windows.delete(display.id);
      // Attempt window resurrection if the display still exists
      setTimeout(() => {
        const displays = screen.getAllDisplays();
        const stillExists = displays.find(d => d.id === display.id);
        if (stillExists && !this.windows.has(display.id)) {
          console.log(`[WinIsland] Resurrecting window for display ${display.id}`);
          this._createWindowForDisplay(stillExists);
        }
      }, 1500);
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
