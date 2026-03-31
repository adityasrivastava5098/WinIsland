// ============================================================
// Dynamic Island for Windows — Main Process
// Entry point for Electron. Manages app lifecycle, IPC routing,
// and orchestrates all backend modules (monitors, media, calendar, tray).
// ============================================================

const { app, ipcMain, screen, shell } = require('electron');
const path = require('path');
const MonitorManager = require('./monitorManager');
const MediaManager = require('./mediaManager');
const CalendarManager = require('./calendarManager');
const TrayManager = require('./trayManager');

// Prevent multiple instances — only one Dynamic Island should run
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// ---- Global references (prevent GC) ----
let monitorManager = null;
let mediaManager = null;
let calendarManager = null;
let trayManager = null;

// ---- Determine if we're in dev or production ----
const isDev = process.env.NODE_ENV === 'development';

// ============================================================
// App ready — bootstrap all modules
// ============================================================
app.whenReady().then(async () => {
  // Initialize the monitor manager (creates one island window per display)
  monitorManager = new MonitorManager(isDev);
  monitorManager.createIslandWindows();

  // Initialize media session polling (SMTC integration)
  mediaManager = new MediaManager();
  mediaManager.startPolling((mediaState) => {
    // Broadcast media state to every island window
    monitorManager.broadcastToAll('media-update', mediaState);
  });

  // Initialize calendar event fetching
  calendarManager = new CalendarManager();
  calendarManager.startPolling((events) => {
    monitorManager.broadcastToAll('calendar-update', events);
  });

  // Initialize system tray icon and menu
  trayManager = new TrayManager(app, monitorManager);

  // Watch for display changes (monitor plugged/unplugged, resolution change)
  screen.on('display-added', () => {
    monitorManager.rebuildWindows();
  });
  screen.on('display-removed', () => {
    monitorManager.rebuildWindows();
  });
  screen.on('display-metrics-changed', () => {
    monitorManager.repositionAll();
  });
});

// ============================================================
// IPC Handlers — renderer → main communication
// ============================================================

// Media playback controls forwarded to the media manager
ipcMain.handle('media-play-pause', () => {
  return mediaManager?.sendCommand('play-pause');
});
ipcMain.handle('media-next', () => {
  return mediaManager?.sendCommand('next');
});
ipcMain.handle('media-previous', () => {
  return mediaManager?.sendCommand('previous');
});

// Let renderer request the current media state on demand
ipcMain.handle('get-media-state', () => {
  return mediaManager?.getCurrentState() || null;
});

// Let renderer request calendar events on demand
ipcMain.handle('get-calendar-events', () => {
  return calendarManager?.getEvents() || [];
});

// Open the source media app (Spotify, Apple Music, browser, etc.)
ipcMain.handle('open-source-app', async (_event, sourceId) => {
  if (!sourceId) return false;
  try {
    // Map known app user model IDs to launch commands
    const appMap = {
      'Spotify.exe': 'spotify:',
      'AppleInc.AppleMusic': 'apple-music:',
      'Microsoft.ZuneMusic': 'mswindowsmusic:',
    };

    // Try to find a matching app
    for (const [key, uri] of Object.entries(appMap)) {
      if (sourceId.toLowerCase().includes(key.toLowerCase())) {
        await shell.openExternal(uri);
        return true;
      }
    }

    // For browsers and unknown apps, try launching via shell
    // The sourceId from SMTC often looks like "chrome.exe" or "msedge.exe"
    if (sourceId.includes('chrome') || sourceId.includes('edge') || sourceId.includes('firefox')) {
      // Can't easily focus a specific browser tab, just ignore
      return false;
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
  // Keep the app running via tray even if all windows close
});

app.on('before-quit', () => {
  mediaManager?.stopPolling();
  calendarManager?.stopPolling();
});
