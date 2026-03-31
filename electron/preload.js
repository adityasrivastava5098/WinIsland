// ============================================================
// Preload Script
// Exposes a safe, sandboxed API to the renderer process via
// contextBridge. The renderer never has direct access to Node
// or Electron APIs — everything goes through this bridge.
// ============================================================

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ---- Media Controls ----
  mediaPlayPause: () => ipcRenderer.invoke('media-play-pause'),
  mediaNext: () => ipcRenderer.invoke('media-next'),
  mediaPrevious: () => ipcRenderer.invoke('media-previous'),
  getMediaState: () => ipcRenderer.invoke('get-media-state'),

  // ---- Open source app (Spotify, Apple Music, etc.) ----
  openSourceApp: (sourceId) => ipcRenderer.invoke('open-source-app', sourceId),

  // ---- Calendar ----
  getCalendarEvents: () => ipcRenderer.invoke('get-calendar-events'),

  // ---- Real-time updates from main process ----
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
});
