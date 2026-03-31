// ============================================================
// Media Manager — SMTC Integration (Rewritten)
// Uses Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager
// to detect ALL active media sessions (Apple Music, Spotify,
// Chrome, Edge, VLC, etc.), prioritize the currently playing
// session, and extract full metadata including album artwork.
// ============================================================

const { execFile } = require('child_process');

// Polling interval — 800ms for near-realtime feel without CPU hammering
const POLL_INTERVAL = 800;

// =================================================================
// PowerShell script: enumerate ALL SMTC sessions, pick the best one
// Priority: Playing > Paused > anything else
// Extracts: title, artist, album, artwork (base64), playback state,
//           timeline, and source app ID.
// =================================================================
const MEDIA_QUERY_SCRIPT = `
Add-Type -AssemblyName System.Runtime.WindowsRuntime

# Helper to await WinRT async operations from PowerShell
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() |
  Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]

Function Await($WinRtTask, $ResultType) {
  $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
  $netTask = $asTask.Invoke($null, @($WinRtTask))
  $netTask.Wait(-1) | Out-Null
  $netTask.Result
}

Function AwaitAction($WinRtTask) {
  $asActionTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and !$_.IsGenericMethod })[0]
  $netTask = $asActionTask.Invoke($null, @($WinRtTask))
  $netTask.Wait(-1) | Out-Null
}

# Load the WinRT type
[void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime]

# Request the session manager
$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])

# Get ALL sessions (not just current)
$sessions = $mgr.GetSessions()

if ($sessions.Count -eq 0) {
  Write-Output '{"status":"no_session"}'
  exit
}

# Score each session: Playing=3, Paused=2, else=1
$best = $null
$bestScore = 0

foreach ($s in $sessions) {
  $pb = $s.GetPlaybackInfo()
  $score = 1
  $statusStr = [string]$pb.PlaybackStatus
  if ($statusStr -eq 'Playing') { $score = 3 }
  elseif ($statusStr -eq 'Paused') { $score = 2 }

  if ($score -gt $bestScore) {
    $bestScore = $score
    $best = $s
  }
}

if ($null -eq $best) {
  Write-Output '{"status":"no_session"}'
  exit
}

# Extract media properties from the best session
$info = Await ($best.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
$playback = $best.GetPlaybackInfo()
$timeline = $best.GetTimelineProperties()

# Extract album artwork as base64
$b64 = ""
if ($null -ne $info.Thumbnail) {
  try {
    $stream = Await ($info.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
    $size = $stream.Size
    if ($size -gt 0 -and $size -lt 10000000) {
      $reader = New-Object Windows.Storage.Streams.DataReader($stream)
      Await ($reader.LoadAsync([uint32]$size)) ([uint32])
      $bytes = New-Object byte[] $size
      $reader.ReadBytes($bytes)
      $b64 = [Convert]::ToBase64String($bytes)
      $reader.Dispose()
    }
    $stream.Dispose()
  } catch {}
}

$obj = @{
  status         = "active"
  title          = [string]$info.Title
  artist         = [string]$info.Artist
  album          = [string]$info.AlbumTitle
  artwork        = $b64
  playbackStatus = [string]$playback.PlaybackStatus
  position       = [math]::Round($timeline.Position.TotalSeconds, 1)
  duration       = [math]::Round($timeline.EndTime.TotalSeconds, 1)
  source         = [string]$best.SourceAppUserModelId
  sessionCount   = $sessions.Count
}
$obj | ConvertTo-Json -Compress
`;

// =================================================================
// PowerShell control commands — use the BEST session (same logic)
// =================================================================
function buildControlScript(action) {
  return `
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() |
  Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
Function Await($WinRtTask, $ResultType) {
  $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
  $netTask = $asTask.Invoke($null, @($WinRtTask))
  $netTask.Wait(-1) | Out-Null
  $netTask.Result
}
[void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime]
$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$sessions = $mgr.GetSessions()
$best = $null; $bestScore = 0
foreach ($s in $sessions) {
  $pb = $s.GetPlaybackInfo()
  $score = 1
  $st = [string]$pb.PlaybackStatus
  if ($st -eq 'Playing') { $score = 3 } elseif ($st -eq 'Paused') { $score = 2 }
  if ($score -gt $bestScore) { $bestScore = $score; $best = $s }
}
if ($best) { $best.${action}.GetAwaiter().GetResult() | Out-Null }
`;
}

const MEDIA_COMMANDS = {
  'play-pause': buildControlScript('TryTogglePlayPauseAsync()'),
  'next':       buildControlScript('TrySkipNextAsync()'),
  'previous':   buildControlScript('TrySkipPreviousAsync()'),
};

class MediaManager {
  constructor() {
    this.currentState = null;
    this.pollTimer = null;
    this._lastStateStr = null;
    this._debounceTimer = null;
  }

  // ----------------------------------------------------------
  // Start polling SMTC for media state changes
  // ----------------------------------------------------------
  startPolling(callback) {
    this.callback = callback;

    const poll = () => {
      this._queryMedia()
        .then((state) => {
          // Debounce: if state changed, wait 150ms before broadcasting
          // to avoid flicker during rapid track changes
          const stateKey = `${state.title}|${state.artist}|${state.playbackStatus}`;
          if (stateKey !== this._lastStateKey) {
            this._lastStateKey = stateKey;
            clearTimeout(this._debounceTimer);
            this._debounceTimer = setTimeout(() => {
              this.currentState = state;
              if (this.callback) this.callback(state);
            }, 150);
          } else {
            // Same track, just update position without debounce
            this.currentState = state;
            if (this.callback) this.callback(state);
          }
        })
        .catch(() => {
          // On error (PowerShell not ready), send no_session
          const noSession = { status: 'no_session' };
          if (this._lastStateKey !== 'no_session') {
            this._lastStateKey = 'no_session';
            this.currentState = noSession;
            if (this.callback) this.callback(noSession);
          }
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
    clearTimeout(this._debounceTimer);
  }

  getCurrentState() {
    return this.currentState;
  }

  // ----------------------------------------------------------
  // Send a media control command to the active session
  // ----------------------------------------------------------
  sendCommand(command) {
    const script = MEDIA_COMMANDS[command];
    if (!script) return Promise.resolve(false);

    return new Promise((resolve) => {
      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
        { timeout: 8000 },
        (err) => resolve(!err)
      );
    });
  }

  // ----------------------------------------------------------
  // Internal: query current media session via PowerShell SMTC
  // ----------------------------------------------------------
  _queryMedia() {
    return new Promise((resolve, reject) => {
      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', MEDIA_QUERY_SCRIPT],
        { timeout: 8000 },
        (err, stdout, stderr) => {
          if (err) return reject(err);
          try {
            const raw = stdout.trim();
            // Find the JSON object in the output (skip any warnings)
            const jsonStart = raw.indexOf('{');
            const jsonEnd = raw.lastIndexOf('}');
            if (jsonStart === -1) return reject(new Error('No JSON in output'));
            const data = JSON.parse(raw.substring(jsonStart, jsonEnd + 1));
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
