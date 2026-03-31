# Dynamic Island for Windows

A sleek, always-on-top overlay that brings Apple's Dynamic Island concept to Windows, optimized for multi-monitor setups.

## Features

- **Multi-Monitor Support** — Automatically detects all displays and renders one island per monitor
- **Music Integration** — Detects media from Spotify, browsers, VLC, and any SMTC-compatible app
- **Calendar Integration** — Shows upcoming Outlook calendar events with countdown
- **Smooth Animations** — Spring-based transitions powered by Framer Motion
- **Acrylic Blur** — Windows Fluent Design-inspired glassmorphism
- **System Tray** — Toggle visibility, auto-start on boot, and more
- **Always-on-Top** — Stays above all windows including most fullscreen apps

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Electron |
| UI | React + Framer Motion |
| Bundler | Vite |
| Media API | Windows SMTC (via PowerShell WinRT) |
| Calendar | Outlook COM Automation |
| Packaging | electron-builder |

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **Windows 10/11** (required for SMTC and WinRT APIs)
- **npm** ≥ 9

### Install

```bash
git clone <repo-url>
cd dynamic_island
npm install
```

### Run in Development

```bash
npm run dev
```

This starts Vite dev server + Electron concurrently with hot reload.

### Build for Production

```bash
npm run build
```

Generates an installer in `dist-electron/`.

## Project Structure

```
dynamic_island/
├── electron/               # Electron main process
│   ├── main.js             # App entry, IPC hub, lifecycle
│   ├── preload.js          # Context bridge (renderer ↔ main)
│   ├── monitorManager.js   # Display detection, window creation
│   ├── mediaManager.js     # SMTC media polling & control
│   ├── calendarManager.js  # Outlook calendar fetching
│   └── trayManager.js      # System tray icon & menu
├── src/                    # React renderer process
│   ├── main.jsx            # React entry point
│   ├── App.jsx             # State management, IPC hooks
│   ├── components/
│   │   ├── DynamicIsland.jsx  # Main island UI + animations
│   │   ├── MusicWidget.jsx    # Expanded music view
│   │   ├── CalendarWidget.jsx # Expanded calendar view
│   │   └── SoundWave.jsx      # Equalizer animation
│   └── styles/
│       └── index.css       # All styles (dark theme)
├── assets/
│   └── tray-icon.png       # System tray icon
├── index.html              # HTML shell
├── vite.config.js          # Vite configuration
└── package.json            # Dependencies & scripts
```

## How It Works

1. **Monitor Manager** detects all displays via Electron's `screen` API and creates one transparent, frameless `BrowserWindow` per monitor, centered at the top edge.

2. **Media Manager** polls Windows SMTC every second using PowerShell + WinRT APIs to get the current track title, artist, album art (as base64), playback status, and timeline.

3. **Calendar Manager** queries Outlook via COM automation every 60 seconds for upcoming events within the next 24 hours.

4. **Dynamic Island UI** animates between three states:
   - **Collapsed** — minimal pill showing track name + sound wave
   - **Peek** — slightly wider on hover
   - **Expanded** — full widget with controls (click to toggle)

## Controls

| Action | Effect |
|--------|--------|
| Hover | Expand to peek state |
| Click | Toggle expanded view |
| Right-click tray | Settings menu |
| Double-click tray | Toggle visibility |

## License

MIT
