// ============================================================
// Media Manager — SMTC Integration (v3)
// Uses GlobalSystemMediaTransportControlsSessionManager to
// detect ALL active media sessions, prioritize playing ones,
// extract artwork, and support seek + all playback controls.
// ============================================================

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

// Polling intervals
const POLL_INTERVAL = 500;        // 500ms for live seekbar updates

// Write the PowerShell script to a temp file for reliable execution
// (inline scripts with backticks and special chars often break)
const PS_SCRIPT_DIR = path.join(require('os').tmpdir(), 'dynamic_island_scripts');

function ensureScriptDir() {
  if (!fs.existsSync(PS_SCRIPT_DIR)) {
    fs.mkdirSync(PS_SCRIPT_DIR, { recursive: true });
  }
}

// =================================================================
// PowerShell script: query all SMTC sessions, pick the best one
// =================================================================
const QUERY_SCRIPT_CONTENT = `
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
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

if ($sessions.Count -eq 0) {
  Write-Output '{"status":"no_session"}'
  exit
}

# Score sessions: Playing=3, Paused=2, else=1
# Break ties with the OS-provided list order (first in list = most recently active)
$best = $null
$bestScore = 0
foreach ($s in $sessions) {
  # Get properties to check if metadata is valid
  $info = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
  if ([string]::IsNullOrEmpty($info.Title)) { continue } # Skip empty/dummy sessions

  $pb = $s.GetPlaybackInfo()
  $score = 1
  $st = [string]$pb.PlaybackStatus
  if ($st -eq 'Playing') { $score = 3 }
  elseif ($st -eq 'Paused') { $score = 2 }
  
  if ($score -gt $bestScore) {
    $bestScore = $score; $best = $s
  }
}

if ($null -eq $best) {
  Write-Output '{"status":"no_session"}'
  exit
}

$info = Await ($best.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
$playback = $best.GetPlaybackInfo()
$timeline = $best.GetTimelineProperties()

# Extract album artwork as base64
$b64 = ""
if ($null -ne $info.Thumbnail) {
  try {
    $asStreamForReadMethod = ([System.IO.WindowsRuntimeStreamExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsStreamForRead' -and $_.GetParameters().Count -eq 1 })[0]
    $stream = Await ($info.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
    
    if ($null -ne $stream -and $null -ne $asStreamForReadMethod) {
      $netStream = $asStreamForReadMethod.Invoke($null, @($stream))
      $ms = New-Object System.IO.MemoryStream
      $buffer = New-Object byte[] 8192
      while (($read = $netStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
        $ms.Write($buffer, 0, $read)
      }
      $bytes = $ms.ToArray()
      if ($bytes.Length -gt 0) {
        $b64 = [Convert]::ToBase64String($bytes)
      }
      $ms.Dispose()
      $netStream.Dispose()
    }
  } catch {}
}

$obj = @{
  status         = "active"
  title          = [string]$info.Title
  artist         = [string]$info.Artist
  album          = [string]$info.AlbumTitle
  artwork        = $b64
  playbackStatus = [string]$playback.PlaybackStatus
  position       = [math]::Round($timeline.Position.TotalSeconds, 2)
  duration       = [math]::Round($timeline.EndTime.TotalSeconds, 2)
  source         = [string]$best.SourceAppUserModelId
  sessionCount   = $sessions.Count
}
$obj | ConvertTo-Json -Compress
`;

// =================================================================
// PowerShell script: send a control command to the best session
// =================================================================
function buildControlScriptContent(action) {
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
  $score = 1; $st = [string]$pb.PlaybackStatus
  if ($st -eq 'Playing') { $score = 3 } elseif ($st -eq 'Paused') { $score = 2 }
  if ($score -gt $bestScore) { $bestScore = $score; $best = $s }
}
if ($best) {
  ${action}
}
`;
}

// =================================================================
// PowerShell script: seek to a specific position (in seconds)
// =================================================================
const SEEK_SCRIPT_CONTENT = `
param([double]$SeekPosition)
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
  $score = 1; $st = [string]$pb.PlaybackStatus
  if ($st -eq 'Playing') { $score = 3 } elseif ($st -eq 'Paused') { $score = 2 }
  if ($score -gt $bestScore) { $bestScore = $score; $best = $s }
}
if ($best) {
  $ticks = [long]($SeekPosition * 10000000)
  $best.TryChangePlaybackPositionAsync($ticks).GetAwaiter().GetResult() | Out-Null
}
`;

class MediaManager {
  constructor() {
    this.currentState = null;
    this.pollTimer = null;
    this._lastStateKey = null;
    this._lastArtwork = null;
    this._debounceTimer = null;
    this._scriptPaths = {};
    this._initScripts();
  }

  // Write all PS scripts to temp files once at startup
  _initScripts() {
    ensureScriptDir();

    // Query script
    const queryPath = path.join(PS_SCRIPT_DIR, 'query.ps1');
    fs.writeFileSync(queryPath, QUERY_SCRIPT_CONTENT, 'utf8');
    this._scriptPaths.query = queryPath;

    // Control scripts
    const actions = {
      'play-pause': '$best.TryTogglePlayPauseAsync().GetAwaiter().GetResult() | Out-Null',
      'next': '$best.TrySkipNextAsync().GetAwaiter().GetResult() | Out-Null',
      'previous': '$best.TrySkipPreviousAsync().GetAwaiter().GetResult() | Out-Null',
    };

    for (const [cmd, action] of Object.entries(actions)) {
      const p = path.join(PS_SCRIPT_DIR, `${cmd}.ps1`);
      fs.writeFileSync(p, buildControlScriptContent(action), 'utf8');
      this._scriptPaths[cmd] = p;
    }

    // Seek script
    const seekPath = path.join(PS_SCRIPT_DIR, 'seek.ps1');
    fs.writeFileSync(seekPath, SEEK_SCRIPT_CONTENT, 'utf8');
    this._scriptPaths.seek = seekPath;
  }

  // ----------------------------------------------------------
  // Start polling SMTC for media state changes
  // ----------------------------------------------------------
  startPolling(callback) {
    this.callback = callback;

    const poll = () => {
      this._queryMedia()
        .then((state) => {
          // Track changes: compare title+artist+status (not position)
          const trackKey = `${state.title}|${state.artist}|${state.playbackStatus}`;

          if (trackKey !== this._lastStateKey) {
            // Track or status changed — debounce to avoid flicker
            this._lastStateKey = trackKey;
            clearTimeout(this._debounceTimer);
            this._debounceTimer = setTimeout(() => {
              this.currentState = state;
              if (this.callback) this.callback(state);
            }, 120);
          } else {
            // Same track — update position immediately (no debounce)
            // But skip artwork in the payload if it hasn't changed
            // to reduce IPC data transfer
            if (state.artwork && state.artwork === this._lastArtwork) {
              state.artwork = '__same__'; // sentinel value
            } else if (state.artwork) {
              this._lastArtwork = state.artwork;
            }
            this.currentState = state;
            if (this.callback) this.callback(state);
          }
        })
        .catch(() => {
          const noSession = { status: 'no_session' };
          if (this._lastStateKey !== '__no_session__') {
            this._lastStateKey = '__no_session__';
            this.currentState = noSession;
            if (this.callback) this.callback(noSession);
          }
        });
    };

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
  // Send a control command (play-pause, next, previous)
  // ----------------------------------------------------------
  sendCommand(command) {
    const scriptPath = this._scriptPaths[command];
    if (!scriptPath) return Promise.resolve(false);

    return new Promise((resolve) => {
      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
        { timeout: 8000 },
        (err) => resolve(!err)
      );
    });
  }

  // ----------------------------------------------------------
  // Seek to a specific position (in seconds)
  // ----------------------------------------------------------
  seekTo(positionSeconds) {
    return new Promise((resolve) => {
      execFile(
        'powershell.exe',
        [
          '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
          '-File', this._scriptPaths.seek,
          '-SeekPosition', String(positionSeconds),
        ],
        { timeout: 8000 },
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
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', this._scriptPaths.query],
        { timeout: 8000 },
        (err, stdout) => {
          if (err) return reject(err);
          try {
            const raw = stdout.trim();
            const jsonStart = raw.indexOf('{');
            const jsonEnd = raw.lastIndexOf('}');
            if (jsonStart === -1) return reject(new Error('No JSON'));
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
