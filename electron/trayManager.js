// ============================================================
// Tray Manager
// Creates a system tray icon with a context menu for controlling
// the Dynamic Island app (toggle visibility, auto-start, quit).
// ============================================================

const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');

class TrayManager {
  constructor(app, monitorManager) {
    this.app = app;
    this.monitorManager = monitorManager;
    this.tray = null;
    this._createTray();
  }

  // ----------------------------------------------------------
  // Build the system tray icon and context menu
  // ----------------------------------------------------------
  _createTray() {
    // Generate a 16x16 tray icon programmatically (dark pill with accent)
    // This avoids dependency on external image files
    const trayIcon = this._createTrayIcon();

    this.tray = new Tray(trayIcon);
    this.tray.setToolTip('Dynamic Island');

    const configManager = require('./configManager');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'WinIsland v1.0',
        enabled: false,  // header label
      },
      { type: 'separator' },
      {
        label: 'Toggle Visibility',
        click: () => {
          this.monitorManager.toggleVisibility();
        },
      },
      {
        label: 'Reposition Islands',
        click: () => {
          this.monitorManager.repositionAll();
        },
      },
      { type: 'separator' },
      {
        label: 'Start with Windows',
        type: 'checkbox',
        checked: configManager.get('runAtStartup', false),
        click: (menuItem) => {
          const isEnabled = menuItem.checked;
          configManager.set('runAtStartup', isEnabled);

          // Configure OS startup registry
          const settings = {
            openAtLogin: isEnabled,
          };

          // If not packaged (dev mode), we MUST specify the path and args
          // otherwise it just launches an empty electron.exe shell on restart.
          if (!this.app.isPackaged) {
            settings.path = process.execPath;
            settings.args = [path.resolve(process.argv[1])];
          }

          this.app.setLoginItemSettings(settings);
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          this.app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);

    // Double-click tray icon → toggle visibility
    this.tray.on('double-click', () => {
      this.monitorManager.toggleVisibility();
    });
  }

  // ----------------------------------------------------------
  // Generate a simple 16x16 tray icon (dark pill with accent)
  // ----------------------------------------------------------
  _createTrayIcon() {
    // Minimal 16x16 PNG: dark rounded rectangle with indigo dot
    // Created as a data URL to avoid external file dependencies
    const { createCanvas } = (() => {
      // Use Electron's nativeImage to create from a buffer
      // We'll create a simple icon using raw pixel data
      return { createCanvas: null };
    })();

    // Use a pre-made minimal 16x16 dark pill icon as base64
    // This is a tiny PNG with a dark rounded rectangle and accent dot
    try {
      const iconPath = require('path').join(__dirname, '..', 'assets', 'tray-icon.png');
      const icon = nativeImage.createFromPath(iconPath);
      if (!icon.isEmpty()) {
        return icon.resize({ width: 16, height: 16 });
      }
    } catch {
      // Fall through to fallback
    }

    // Ultimate fallback: create from raw RGBA buffer
    const size = 16;
    const buffer = Buffer.alloc(size * size * 4, 0);

    // Draw a simple filled circle (indigo #6366f1)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - 7.5;
        const dy = y - 7.5;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const idx = (y * size + x) * 4;

        if (dist < 6) {
          // Indigo fill
          buffer[idx] = 99;      // R
          buffer[idx + 1] = 102; // G
          buffer[idx + 2] = 241; // B
          buffer[idx + 3] = 255; // A
        } else if (dist < 7) {
          // Anti-aliased edge
          const alpha = Math.max(0, Math.min(255, Math.round((7 - dist) * 255)));
          buffer[idx] = 99;
          buffer[idx + 1] = 102;
          buffer[idx + 2] = 241;
          buffer[idx + 3] = alpha;
        }
      }
    }

    return nativeImage.createFromBuffer(buffer, {
      width: size,
      height: size,
    });
  }
}

module.exports = TrayManager;
