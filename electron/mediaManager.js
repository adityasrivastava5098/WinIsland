// ============================================================
// Media Manager
// Polls the Windows System Media Transport Controls (SMTC)
// via PowerShell to detect currently playing media from any
// source (Spotify, browsers, VLC, etc.).
// Also sends playback commands (play/pause, next, previous).
// ============================================================

const { execFile } = require('child_process');
const path = require('path');

// Polling interval in milliseconds
const POLL_INTERVAL = 1000;

// PowerShell script to query SMTC for current media info.
// Uses the Windows.Media.Control WinRT API available on Win10+.
const MEDIA_QUERY_SCRIPT = `
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime] | Out-Null
$mgr = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync().GetAwaiter().GetResult()
$session = $mgr.GetCurrentSession()
if ($null -eq $session) {
  Write-Output '{"status":"no_session"}'
  exit
}
$info = $session.TryGetMediaPropertiesAsync().GetAwaiter().GetResult()
$playback = $session.GetPlaybackInfo()
$timeline = $session.GetTimelineProperties()

$thumbRef = $info.Thumbnail
$b64 = ""
if ($null -ne $thumbRef) {
  try {
    $stream = $thumbRef.OpenReadAsync().GetAwaiter().GetResult()
    $reader = New-Object Windows.Storage.Streams.DataReader($stream)
    $reader.LoadAsync([uint32]$stream.Size).GetAwaiter().GetResult() | Out-Null
    $bytes = New-Object byte[] $stream.Size
    $reader.ReadBytes($bytes)
    $b64 = [Convert]::ToBase64String($bytes)
    $reader.Dispose()
    $stream.Dispose()
  } catch {}
}

$obj = @{
  status   = "playing"
  title    = [string]$info.Title
  artist   = [string]$info.Artist
  album    = [string]$info.AlbumTitle
  artwork  = $b64
  playbackStatus = [string]$playback.PlaybackStatus
  position = $timeline.Position.TotalSeconds
  duration = $timeline.EndTime.TotalSeconds
  source   = [string]$session.SourceAppUserModelId
}
$obj | ConvertTo-Json -Compress
`;

// PowerShell command to send media control keys
const MEDIA_COMMANDS = {
  'play-pause': `
    [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime] | Out-Null
    $mgr = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync().GetAwaiter().GetResult()
    $session = $mgr.GetCurrentSession()
    if ($session) { $session.TryTogglePlayPauseAsync().GetAwaiter().GetResult() }
  `,
  'next': `
    [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime] | Out-Null
    $mgr = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync().GetAwaiter().GetResult()
    $session = $mgr.GetCurrentSession()
    if ($session) { $session.TrySkipNextAsync().GetAwaiter().GetResult() }
  `,
  'previous': `
    [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime] | Out-Null
    $mgr = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync().GetAwaiter().GetResult()
    $session = $mgr.GetCurrentSession()
    if ($session) { $session.TrySkipPreviousAsync().GetAwaiter().GetResult() }
  `,
};

class MediaManager {
  constructor() {
    this.currentState = null;
    this.pollTimer = null;
  }

  // ----------------------------------------------------------
  // Start polling SMTC for media state changes
  // ----------------------------------------------------------
  startPolling(callback) {
    this.callback = callback;

    const poll = () => {
      this._queryMedia()
        .then((state) => {
          // Only broadcast if state actually changed
          const stateStr = JSON.stringify(state);
          if (stateStr !== this._lastStateStr) {
            this._lastStateStr = stateStr;
            this.currentState = state;
            if (this.callback) this.callback(state);
          }
        })
        .catch(() => {
          // Silently ignore errors (e.g. PowerShell not ready)
        });
    };

    // Initial poll immediately
    poll();
    this.pollTimer = setInterval(poll, POLL_INTERVAL);
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  getCurrentState() {
    return this.currentState;
  }

  // ----------------------------------------------------------
  // Send a media control command (play/pause, next, previous)
  // ----------------------------------------------------------
  sendCommand(command) {
    const script = MEDIA_COMMANDS[command];
    if (!script) return Promise.resolve(false);

    return new Promise((resolve) => {
      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', script],
        { timeout: 5000 },
        (err) => resolve(!err)
      );
    });
  }

  // ----------------------------------------------------------
  // Internal: query current media session via PowerShell
  // ----------------------------------------------------------
  _queryMedia() {
    return new Promise((resolve, reject) => {
      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', MEDIA_QUERY_SCRIPT],
        { timeout: 5000 },
        (err, stdout) => {
          if (err) return reject(err);
          try {
            const data = JSON.parse(stdout.trim());
            resolve(data);
          } catch (e) {
            reject(e);
          }
        }
      );
    });
  }
}

module.exports = MediaManager;
