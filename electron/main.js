// ============================================================
// Dynamic Island for Windows — Main Process (v4)
// Entry point for Electron. Manages IPC, orchestrates
// monitors, media, calendar, tray, and startup modules.
// ============================================================

const { app, ipcMain, screen, shell, BrowserWindow } = require('electron');

// Force software rendering to avoid GPU shared-context failures
// on virtualized/restricted Windows environments.
app.disableHardwareAcceleration();

// ---- ENHANCED COMPATIBILITY MODE ----
// Specific flags to bypass D3D11 virtualization context failures
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-d3d11');
app.commandLine.appendSwitch('use-angle', 'd3d9'); // Fallback to D3D9 which is more stable in virtual/restricted environments
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-rasterization');
// -------------------------------------

const { execFile } = require('child_process');
const path = require('path');
const configManager = require('./configManager');
const MonitorManager = require('./monitorManager');
const MediaManager = require('./mediaManager');
const CalendarManager = require('./calendarManager');
const TrayManager = require('./trayManager');
const startupManager = require('./startupManager');

// ---- Fix GPU and Cache Issues ----
// Disable GPU acceleration as it can cause crashes on certain systems/drivers
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-gpu-rasterization');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('no-sandbox'); // Necessary for some permission-locked environments

// ---- Custom Data Path (Fixes "Access Denied" Cache Errors) ----
// By moving the user data to a local project folder, we bypass restricted %AppData% permissions
const userDataPath = path.join(process.cwd(), '.winisland_data');
app.setPath('userData', userDataPath);
// ----------------------------------

// ---- Parse CLI Flags ----
const isStartMinimized = process.argv.includes('--start-minimized');
const startupDelayArg = process.argv.find(a => a.startsWith('--startup-delay='));
const startupDelay = startupDelayArg ? parseInt(startupDelayArg.split('=')[1], 10) * 1000 : 0;

// ---- Single Instance Lock ----
// Prevent duplicate instances — critical for a background utility
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// ---- Global references ----
let monitorManager = null;
let mediaManager = null;
let calendarManager = null;
let trayManager = null;

// Treat local (unpackaged) runs as development by default.
// This avoids accidental file://dist/index.html loads when running `npx electron .`.
const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

// ============================================================
// Bootstrap — the actual initialization logic
// ============================================================
function bootstrap() {
  // ----------------------------------------------------------
  // Verify startup registry/shortcut on every launch
  // ----------------------------------------------------------
  const runAtStartup = configManager.get('runAtStartup', false);
  const startMinimizedPref = configManager.get('startMinimized', true);
  const delaySecondsPref = configManager.get('startupDelaySeconds', 2);

  startupManager.verify(runAtStartup, {
    startMinimized: startMinimizedPref,
    delaySeconds: delaySecondsPref,
  });

  // ----------------------------------------------------------
  // Create island windows on all monitors
  // ----------------------------------------------------------
  monitorManager = new MonitorManager(isDev);
  monitorManager.createIslandWindows();

  // ----------------------------------------------------------
  // Start media polling
  // ----------------------------------------------------------
  mediaManager = new MediaManager();
  mediaManager.startPolling((mediaState) => {
    monitorManager.broadcastToAll('media-update', mediaState);
  });

  // ----------------------------------------------------------
  // Start calendar polling
  // ----------------------------------------------------------
  calendarManager = new CalendarManager();
  calendarManager.startPolling((events) => {
    monitorManager.broadcastToAll('calendar-update', events);
  });

  // ----------------------------------------------------------
  // System tray (includes startup toggle)
  // ----------------------------------------------------------
  trayManager = new TrayManager(app, monitorManager);

  // ----------------------------------------------------------
  // Display change listeners
  // ----------------------------------------------------------
  screen.on('display-added', () => monitorManager.rebuildWindows());
  screen.on('display-removed', () => monitorManager.rebuildWindows());
  screen.on('display-metrics-changed', () => monitorManager.repositionAll());
}

// ============================================================
// App ready
// ============================================================
app.whenReady().then(async () => {
  if (startupDelay > 0 && isStartMinimized) {
    // Delay launch for smoother system startup when auto-started
    console.log(`[WinIsland] Delaying startup by ${startupDelay / 1000}s for smoother boot...`);
    setTimeout(() => bootstrap(), startupDelay);
  } else {
    bootstrap();
  }
});

// When a second instance is launched, just focus/show existing windows
app.on('second-instance', () => {
  if (monitorManager) {
    for (const [, entry] of monitorManager.windows) {
      if (!entry.win.isDestroyed()) {
        entry.win.show();
      }
    }
  }
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

// Toggle click-through for transparent regions
ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.setIgnoreMouseEvents(ignore, options);
});

// Calendar events
ipcMain.handle('get-calendar-events', () => calendarManager?.getEvents() || []);

// Startup settings IPC — allows renderer to query/toggle startup
ipcMain.handle('get-startup-status', () => {
  return {
    enabled: configManager.get('runAtStartup', false),
    startMinimized: configManager.get('startMinimized', true),
    delaySeconds: configManager.get('startupDelaySeconds', 2),
    systemStatus: startupManager.getStatus(),
  };
});

ipcMain.handle('set-startup-enabled', (_event, enabled) => {
  configManager.set('runAtStartup', enabled);
  if (enabled) {
    return startupManager.enable({
      startMinimized: configManager.get('startMinimized', true),
      delaySeconds: configManager.get('startupDelaySeconds', 2),
    });
  } else {
    return startupManager.disable();
  }
});

ipcMain.handle('set-startup-options', (_event, options) => {
  if (options.startMinimized !== undefined) {
    configManager.set('startMinimized', options.startMinimized);
  }
  if (options.delaySeconds !== undefined) {
    configManager.set('startupDelaySeconds', options.delaySeconds);
  }
  // Re-apply if startup is enabled
  if (configManager.get('runAtStartup', false)) {
    return startupManager.enable({
      startMinimized: configManager.get('startMinimized', true),
      delaySeconds: configManager.get('startupDelaySeconds', options.delaySeconds || 2),
    });
  }
  return { success: true };
});

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
