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
});
