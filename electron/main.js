// ============================================================
// Dynamic Island for Windows — Main Process (v3)
// Entry point for Electron. Manages IPC, orchestrates
// monitors, media, calendar, and tray modules.
// ============================================================

const { app, ipcMain, screen, shell } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const MonitorManager = require('./monitorManager');
const MediaManager = require('./mediaManager');
const CalendarManager = require('./calendarManager');
const TrayManager = require('./trayManager');

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// ---- Global references ----
let monitorManager = null;
let mediaManager = null;
let calendarManager = null;
let trayManager = null;

const isDev = process.env.NODE_ENV === 'development';

// ============================================================
// App ready
// ============================================================
app.whenReady().then(async () => {
  monitorManager = new MonitorManager(isDev);
  monitorManager.createIslandWindows();

  mediaManager = new MediaManager();
  mediaManager.startPolling((mediaState) => {
    monitorManager.broadcastToAll('media-update', mediaState);
  });

  calendarManager = new CalendarManager();
  calendarManager.startPolling((events) => {
    monitorManager.broadcastToAll('calendar-update', events);
  });

  trayManager = new TrayManager(app, monitorManager);

  screen.on('display-added', () => monitorManager.rebuildWindows());
  screen.on('display-removed', () => monitorManager.rebuildWindows());
  screen.on('display-metrics-changed', () => monitorManager.repositionAll());
});

// ============================================================
// IPC Handlers
// ============================================================

// Media controls
ipcMain.handle('media-play-pause', () => mediaManager?.sendCommand('play-pause'));
ipcMain.handle('media-next', () => mediaManager?.sendCommand('next'));
ipcMain.handle('media-previous', () => mediaManager?.sendCommand('previous'));
ipcMain.handle('get-media-state', () => mediaManager?.getCurrentState() || null);

// Seek to position (seconds)
ipcMain.handle('media-seek', (_event, positionSeconds) => {
  return mediaManager?.seekTo(positionSeconds);
});

// Calendar events
ipcMain.handle('get-calendar-events', () => calendarManager?.getEvents() || []);

// Open source media app
ipcMain.handle('open-source-app', async (_event, sourceId) => {
  if (!sourceId) return false;
  try {
    const s = sourceId.toLowerCase();

    // Spotify
    if (s.includes('spotify')) {
      await shell.openExternal('spotify:');
      return true;
    }

    // Apple Music — use start command to activate the UWP app
    if (s.includes('apple') || s.includes('itunes')) {
      return new Promise((resolve) => {
        execFile('cmd.exe', ['/c', 'start', 'shell:AppsFolder\\AppleInc.AppleMusic_nzyj5cx40ttqa!App'], { timeout: 5000 }, (err) => {
          if (err) {
            // Fallback: try generic start
            execFile('cmd.exe', ['/c', 'start', 'apple-music:'], { timeout: 5000 }, () => resolve(true));
          } else {
            resolve(true);
          }
        });
      });
    }

    // Groove Music / Zune
    if (s.includes('zunemusic') || s.includes('groove')) {
      await shell.openExternal('mswindowsmusic:');
      return true;
    }

    // Edge — bring to front
    if (s.includes('edge') || s.includes('msedge')) {
      execFile('cmd.exe', ['/c', 'start', 'msedge:'], { timeout: 3000 }, () => {});
      return true;
    }

    // Chrome
    if (s.includes('chrome')) {
      execFile('cmd.exe', ['/c', 'start', 'chrome:'], { timeout: 3000 }, () => {});
      return true;
    }

    return false;
  } catch {
    return false;
  }
});

// ============================================================
// App lifecycle
// ============================================================
app.on('window-all-closed', () => {
  // keep running via tray
});

app.on('before-quit', () => {
  mediaManager?.stopPolling();
  calendarManager?.stopPolling();
});
