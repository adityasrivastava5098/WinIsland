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
    // Create a simple 16x16 tray icon (rounded dark pill shape)
    const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png');
    let trayIcon;

    try {
      trayIcon = nativeImage.createFromPath(iconPath);
    } catch {
      // Fallback: create a simple icon programmatically
      trayIcon = nativeImage.createEmpty();
    }

    // Resize for tray (16x16 is standard on Windows)
    if (!trayIcon.isEmpty()) {
      trayIcon = trayIcon.resize({ width: 16, height: 16 });
    }

    this.tray = new Tray(trayIcon);
    this.tray.setToolTip('Dynamic Island');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Dynamic Island',
        enabled: false,  // header label, not clickable
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
        checked: this.app.getLoginItemSettings().openAtLogin,
        click: (menuItem) => {
          this.app.setLoginItemSettings({
            openAtLogin: menuItem.checked,
          });
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
}

module.exports = TrayManager;
