// ============================================================
// WinIsland — Main Process
// ============================================================

const { app, ipcMain, screen, shell, BrowserWindow } = require('electron');
const path = require('path');
const configManager = require('./configManager');
const MonitorManager = require('./monitorManager');
const MediaManager = require('./mediaManager');
const CalendarManager = require('./calendarManager');
const TrayManager = require('./trayManager');
const startupManager = require('./startupManager');

// Single Instance Lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// Treat local (unpackaged) runs as development
const isDev = !app.isPackaged;

// Global references
let monitorManager = null;
let mediaManager = null;
let calendarManager = null;
let trayManager = null;

// Parse CLI Flags
const isStartMinimized = process.argv.includes('--start-minimized');

function bootstrap() {
  // 1. Verify startup registry on every launch
  const runAtStartup = configManager.get('runAtStartup', false);
  startupManager.verify(runAtStartup);

  // 2. Create island windows
  monitorManager = new MonitorManager(isDev);
  monitorManager.createIslandWindows();

  // 3. Start polling services
  mediaManager = new MediaManager();
  mediaManager.startPolling((mediaState) => {
    monitorManager.broadcastToAll('media-update', mediaState);
  });

  calendarManager = new CalendarManager();
  calendarManager.startPolling((events) => {
    monitorManager.broadcastToAll('calendar-update', events);
  });

  // 4. System tray
  trayManager = new TrayManager(app, monitorManager);

  // 5. Display change listeners
  screen.on('display-added', () => monitorManager.rebuildWindows());
  screen.on('display-removed', () => monitorManager.rebuildWindows());
  screen.on('display-metrics-changed', () => monitorManager.repositionAll());

  // Handle minimized launch
  if (isStartMinimized) {
    // In start-minimized mode, we don't show windows initially if they were supposed to be hidden.
    // However, Dynamic Island is always-on-top but can be collapsed.
    // We'll let the renderer handle the initial collapsed state based on this flag if needed.
    monitorManager.broadcastToAll('startup-minimized', true);
  }
}

app.whenReady().then(() => {
  bootstrap();
});

// Second instance handling
app.on('second-instance', () => {
  if (monitorManager) {
    monitorManager.windows.forEach(entry => {
      if (!entry.win.isDestroyed()) {
        entry.win.show();
        entry.win.focus();
      }
    });
  }
});

// IPC Handlers
ipcMain.handle('get-startup-status', () => {
  return {
    isDev,
    configEnabled: configManager.get('runAtStartup', false),
    systemStatus: startupManager.checkStartupStatus(),
    exePath: app.getPath('exe')
  };
});

ipcMain.handle('toggle-startup', (_event, enabled) => {
  if (!app.isPackaged) return { success: false, error: 'Startup toggle only available in production' };
  
  configManager.set('runAtStartup', enabled);
  if (enabled) {
    return startupManager.enable();
  } else {
    return startupManager.disable();
  }
});

ipcMain.handle('test-startup', () => {
  // Simulation: relaunch app with --start-minimized
  const { spawn } = require('child_process');
  spawn(app.getPath('exe'), ['--start-minimized'], {
    detached: true,
    stdio: 'ignore'
  }).unref();
  return { success: true };
});

// Media/Calendar Handlers (Keep existing)
ipcMain.handle('media-play-pause', () => mediaManager?.sendCommand('play-pause'));
ipcMain.handle('media-next', () => mediaManager?.sendCommand('next'));
ipcMain.handle('media-previous', () => mediaManager?.sendCommand('previous'));
ipcMain.handle('get-media-state', () => mediaManager?.getCurrentState() || null);
ipcMain.handle('media-seek', (_event, pos) => mediaManager?.seekTo(pos));
ipcMain.handle('get-calendar-events', () => calendarManager?.getEvents() || []);

ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.setIgnoreMouseEvents(ignore, options);
});

app.on('window-all-closed', () => {
  // Stay running in tray
});

app.on('before-quit', () => {
  mediaManager?.stopPolling();
  calendarManager?.stopPolling();
});
