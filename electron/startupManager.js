// ============================================================
// Startup Manager
// Manages "Start with Windows" functionality via two methods:
//   1. Primary:  Windows Registry (HKCU\...\Run)
//   2. Fallback: Startup folder shortcut
// ============================================================

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const APP_NAME = 'WinIsland';
const REG_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';

class StartupManager {
  constructor() {
    // Resolve the executable path — in dev it's electron.exe + project path,
    // in production it's the packaged .exe
    this._exePath = this._resolveExePath();
    this._startupFolderPath = this._resolveStartupFolder();
  }

  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------

  /**
   * Enable auto-start on Windows boot.
   * Tries Registry first, then falls back to Startup Folder shortcut.
   * @param {object} options
   * @param {boolean} [options.startMinimized=true] - Launch minimized (silently)
   * @param {number}  [options.delaySeconds=2]      - Delay before launch (smoother boot)
   * @returns {{ method: string, success: boolean, error?: string }}
   */
  enable(options = {}) {
    const { startMinimized = true, delaySeconds = 2 } = options;

    // Build the command string with optional flags
    let command = this._exePath;
    if (!app.isPackaged) {
      // In dev mode, we need: electron.exe <project-path>
      command = `"${process.execPath}" "${path.resolve(process.argv[1])}"`;
    } else {
      command = `"${command}"`;
    }

    if (startMinimized) {
      command += ' --start-minimized';
    }
    if (delaySeconds > 0) {
      command += ` --startup-delay=${delaySeconds}`;
    }

    // Primary: Registry
    const registryResult = this._enableViaRegistry(command);
    if (registryResult.success) {
      return { method: 'registry', success: true };
    }

    console.warn(`[StartupManager] Registry method failed: ${registryResult.error}, trying startup folder...`);

    // Fallback: Startup Folder
    const folderResult = this._enableViaStartupFolder(command);
    if (folderResult.success) {
      return { method: 'startup-folder', success: true };
    }

    return {
      method: 'none',
      success: false,
      error: `Registry: ${registryResult.error} | Folder: ${folderResult.error}`,
    };
  }

  /**
   * Disable auto-start — removes from both Registry and Startup Folder.
   * @returns {{ success: boolean, error?: string }}
   */
  disable() {
    const errors = [];

    const regResult = this._disableViaRegistry();
    if (!regResult.success) errors.push(`Registry: ${regResult.error}`);

    const folderResult = this._disableViaStartupFolder();
    if (!folderResult.success) errors.push(`Folder: ${folderResult.error}`);

    return {
      success: errors.length === 0,
      error: errors.length > 0 ? errors.join(' | ') : undefined,
    };
  }

  /**
   * Check if auto-start is currently enabled (in either method).
   * @returns {{ enabled: boolean, method: string|null }}
   */
  getStatus() {
    if (this._isRegistryEntryPresent()) {
      return { enabled: true, method: 'registry' };
    }
    if (this._isStartupShortcutPresent()) {
      return { enabled: true, method: 'startup-folder' };
    }
    return { enabled: false, method: null };
  }

  /**
   * Verify and repair the startup entry — ensures the path is correct.
   * Called on app launch to fix stale paths (e.g., app was moved).
   * @param {boolean} shouldBeEnabled - Whether startup should be active
   * @param {object}  options         - Same options as enable()
   */
  verify(shouldBeEnabled, options = {}) {
    const status = this.getStatus();

    if (shouldBeEnabled && !status.enabled) {
      // Config says enabled but entry is missing — re-enable
      console.log('[StartupManager] Startup entry missing, re-enabling...');
      this.enable(options);
    } else if (shouldBeEnabled && status.enabled) {
      // Verify the path is correct (app may have been moved)
      this._verifyRegistryPath(options);
    } else if (!shouldBeEnabled && status.enabled) {
      // Config says disabled but entry exists — remove it
      console.log('[StartupManager] Startup entry found but disabled in config, removing...');
      this.disable();
    }
  }

  // ----------------------------------------------------------
  // Registry Methods (Primary)
  // ----------------------------------------------------------

  _enableViaRegistry(command) {
    try {
      const regCommand = `reg add "${REG_KEY}" /v "${APP_NAME}" /t REG_SZ /d ${this._escapeRegValue(command)} /f`;
      execSync(regCommand, { windowsHide: true, stdio: 'pipe' });
      console.log(`[StartupManager] Registry entry added: ${APP_NAME}`);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  _disableViaRegistry() {
    try {
      execSync(`reg delete "${REG_KEY}" /v "${APP_NAME}" /f`, {
        windowsHide: true,
        stdio: 'pipe',
      });
      console.log(`[StartupManager] Registry entry removed: ${APP_NAME}`);
      return { success: true };
    } catch (err) {
      // Not an error if the key doesn't exist
      if (err.message.includes('unable to find') || err.message.includes('The system was unable')) {
        return { success: true };
      }
      return { success: false, error: err.message };
    }
  }

  _isRegistryEntryPresent() {
    try {
      const output = execSync(`reg query "${REG_KEY}" /v "${APP_NAME}"`, {
        windowsHide: true,
        stdio: 'pipe',
        encoding: 'utf-8',
      });
      return output.includes(APP_NAME);
    } catch {
      return false;
    }
  }

  _verifyRegistryPath(options = {}) {
    try {
      const output = execSync(`reg query "${REG_KEY}" /v "${APP_NAME}"`, {
        windowsHide: true,
        stdio: 'pipe',
        encoding: 'utf-8',
      });

      // Check if the current exe path is in the registry value
      const currentPath = app.isPackaged ? this._exePath : process.execPath;
      if (!output.includes(currentPath)) {
        console.log('[StartupManager] Registry path is stale, updating...');
        this.enable(options);
      }
    } catch {
      // Entry doesn't exist — will be handled by verify()
    }
  }

  // ----------------------------------------------------------
  // Startup Folder Methods (Fallback)
  // ----------------------------------------------------------

  _enableViaStartupFolder(command) {
    try {
      const shortcutPath = path.join(this._startupFolderPath, `${APP_NAME}.bat`);

      // Create a batch file that runs the app with optional delay
      // Using a .bat because creating .lnk shortcuts requires COM/PowerShell
      const lines = ['@echo off', 'rem WinIsland Auto-Start'];

      // Extract delay from command if present
      const delayMatch = command.match(/--startup-delay=(\d+)/);
      if (delayMatch) {
        lines.push(`timeout /t ${delayMatch[1]} /nobreak >nul`);
      }

      lines.push(`start "" ${command}`);

      fs.writeFileSync(shortcutPath, lines.join('\r\n') + '\r\n', 'utf-8');
      console.log(`[StartupManager] Startup folder shortcut created: ${shortcutPath}`);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  _disableViaStartupFolder() {
    try {
      const shortcutPath = path.join(this._startupFolderPath, `${APP_NAME}.bat`);
      if (fs.existsSync(shortcutPath)) {
        fs.unlinkSync(shortcutPath);
        console.log(`[StartupManager] Startup folder shortcut removed: ${shortcutPath}`);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  _isStartupShortcutPresent() {
    try {
      const shortcutPath = path.join(this._startupFolderPath, `${APP_NAME}.bat`);
      return fs.existsSync(shortcutPath);
    } catch {
      return false;
    }
  }

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------

  _resolveExePath() {
    if (app.isPackaged) {
      return app.getPath('exe');
    }
    // In dev, electron.exe is the exec, project path is argv[1]
    return process.execPath;
  }

  _resolveStartupFolder() {
    // Windows Startup folder: %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
    const appData = process.env.APPDATA || path.join(require('os').homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
  }

  _escapeRegValue(value) {
    // Wrap in quotes for reg add, escape inner quotes
    return `"${value.replace(/"/g, '\\"')}"`;
  }
}

module.exports = new StartupManager();
