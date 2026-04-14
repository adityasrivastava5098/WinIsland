// ============================================================
// Preload — Secure IPC bridge between renderer and main process
// ============================================================

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ---- Media Controls ----
  mediaPlayPause: () => ipcRenderer.invoke('media-play-pause'),
  mediaNext: () => ipcRenderer.invoke('media-next'),
  mediaPrevious: () => ipcRenderer.invoke('media-previous'),
  mediaSeek: (posSeconds) => ipcRenderer.invoke('media-seek', posSeconds),
  getMediaState: () => ipcRenderer.invoke('get-media-state'),

  // ---- Open source app ----
  openSourceApp: (sourceId) => ipcRenderer.invoke('open-source-app', sourceId),

  // ---- Window handling ----
  setIgnoreMouseEvents: (ignore, options) => ipcRenderer.send('set-ignore-mouse-events', ignore, options),

  // ---- Calendar ----
  getCalendarEvents: () => ipcRenderer.invoke('get-calendar-events'),

  // ---- Real-time updates ----
  onMediaUpdate: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('media-update', handler);
    return () => ipcRenderer.removeListener('media-update', handler);
  },
  onCalendarUpdate: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('calendar-update', handler);
    return () => ipcRenderer.removeListener('calendar-update', handler);
  },

  // ---- Startup Settings ----
  getStartupStatus: () => ipcRenderer.invoke('get-startup-status'),
  toggleStartup: (enabled) => ipcRenderer.invoke('toggle-startup', enabled),
  testStartup: () => ipcRenderer.invoke('test-startup'),

  // ---- Calendar Settings ----
  getCalendarStatus: () => ipcRenderer.invoke('get-calendar-status'),
  toggleCalendarIntegration: (enabled) => ipcRenderer.invoke('toggle-calendar-integration', enabled),

  // ---- Display Mode ----
  getDisplayMode: () => ipcRenderer.invoke('get-display-mode'),
  setDisplayMode: (mode) => ipcRenderer.invoke('set-display-mode', mode),
  onDisplayModeChanged: (callback) => {
    const handler = (_event, mode) => callback(mode);
    ipcRenderer.on('display-mode-changed', handler);
    return () => ipcRenderer.removeListener('display-mode-changed', handler);
  },
});
