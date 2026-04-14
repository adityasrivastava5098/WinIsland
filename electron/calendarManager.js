// ============================================================
// Calendar Manager
// Fetches upcoming calendar events from Windows via PowerShell
// Outlook COM automation. Falls back to a stub if Outlook
// is not installed.
// ============================================================

const { execFile } = require('child_process');

// Poll every 60 seconds (calendar events don't change rapidly)
const POLL_INTERVAL = 60000;

// PowerShell script to fetch upcoming events from Outlook
// Uses the Outlook COM object to read the default calendar folder
const CALENDAR_QUERY_SCRIPT = `
try {
  $outlook = New-Object -ComObject Outlook.Application
  $namespace = $outlook.GetNamespace("MAPI")
  $calFolder = $namespace.GetDefaultFolder(9) # olFolderCalendar
  $now = Get-Date
  $endTime = $now.AddHours(24)
  $filter = "[Start] >= '" + $now.ToString("g") + "' AND [Start] <= '" + $endTime.ToString("g") + "'"
  $items = $calFolder.Items
  $items.Sort("[Start]")
  $items.IncludeRecurrences = $true
  $filtered = $items.Restrict($filter)

  $events = @()
  foreach ($item in $filtered) {
    $events += @{
      title = [string]$item.Subject
      start = $item.Start.ToString("o")
      end = $item.End.ToString("o")
      location = [string]$item.Location
      isAllDay = [bool]$item.AllDayEvent
    }
    if ($events.Count -ge 5) { break }
  }

  @{ status = "ok"; events = $events } | ConvertTo-Json -Compress -Depth 3
} catch {
  @{ status = "unavailable"; events = @() } | ConvertTo-Json -Compress
}
`;

class CalendarManager {
  constructor() {
    this.events = [];
    this.pollTimer = null;
    this.callback = null;
  }

  // ----------------------------------------------------------
  // Start polling for calendar events
  // ----------------------------------------------------------
  startPolling(callback) {
    this.stopPolling();
    this.callback = callback;

    const poll = () => {
      this._fetchEvents()
        .then((result) => {
          if (result.status === 'ok') {
            this.events = result.events || [];
          } else {
            this.events = [];
          }
          if (this.callback) this.callback(this.events);
        })
        .catch(() => {
          // Outlook not available or other error — silently degrade
          this.events = [];
          if (this.callback) this.callback(this.events);
        });
    };

    // Initial fetch
    poll();
    this.pollTimer = setInterval(poll, POLL_INTERVAL);
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  getEvents() {
    return this.events;
  }

  // ----------------------------------------------------------
  // Internal: run PowerShell script to fetch events
  // ----------------------------------------------------------
  _fetchEvents() {
    return new Promise((resolve, reject) => {
      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', CALENDAR_QUERY_SCRIPT],
        { timeout: 10000 },
        (err, stdout) => {
          if (err) return reject(err);
          try {
            resolve(JSON.parse(stdout.trim()));
          } catch (e) {
            reject(e);
          }
        }
      );
    });
  }
}

module.exports = CalendarManager;
