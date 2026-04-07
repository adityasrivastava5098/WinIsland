// ============================================================
// Startup Manager (Production-Ready)
// Manages "Start with Windows" functionality via Windows Registry (HKCU\...\Run)
// ============================================================

const { app } = require('electron');
const path = require('path');
const { execSync } = require('child_process');

const APP_NAME = 'WinIsland';
const REG_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';

class StartupManager {
  constructor() {
    this._exePath = app.getPath('exe');
  }

  /**
   * Enable auto-start on Windows boot using Registry.
   * @param {object} options
   * @param {boolean} [options.startMinimized=true]
   * @returns {{ success: boolean, error?: string }}
   */
  enable(options = {}) {
    if (!app.isPackaged) {
      console.warn('[StartupManager] Registry startup only works in production build.');
      return { success: false, error: 'Startup only works in production build' };
    }

    const { startMinimized = true } = options;
    let command = `"${this._exePath}"`;
    
    if (startMinimized) {
      command += ' --start-minimized';
    }

    try {
      // Use REG ADD to insert into registry
      // /v is value name, /t is type, /d is data, /f is force overwrite
      const regCommand = `reg add "${REG_KEY}" /v "${APP_NAME}" /t REG_SZ /d "${command.replace(/"/g, '\\"')}" /f`;
      execSync(regCommand, { windowsHide: true, stdio: 'pipe' });
      
      // Verify after writing
      return this.verifyRegistryEntry(command);
    } catch (err) {
      console.error('[StartupManager] Failed to enable startup:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Disable auto-start by removing Registry entry.
   */
  disable() {
    try {
      execSync(`reg delete "${REG_KEY}" /v "${APP_NAME}" /f`, {
        windowsHide: true,
        stdio: 'pipe',
      });
      return { success: true };
    } catch (err) {
      // If already missing, consider it a success
      if (err.message.includes('unable to find')) return { success: true };
      return { success: false, error: err.message };
    }
  }

  /**
   * Check current startup status and path validity.
   * @returns {'Valid' | 'Missing' | 'Broken path'}
   */
  checkStartupStatus() {
    try {
      const output = execSync(`reg query "${REG_KEY}" /v "${APP_NAME}"`, {
        windowsHide: true,
        stdio: 'pipe',
        encoding: 'utf-8',
      });
      
      if (!output.includes(APP_NAME)) return 'Missing';
      
      // Extract the path from registry output
      // Output format is usually: WinIsland    REG_SZ    "path" --flags
      if (!output.includes(this._exePath)) return 'Broken path';
      
      return 'Valid';
    } catch {
      return 'Missing';
    }
  }

  /**
   * Low-level verification of the registry entry content
   */
  verifyRegistryEntry(expectedCommand) {
    try {
      const output = execSync(`reg query "${REG_KEY}" /v "${APP_NAME}"`, {
        windowsHide: true,
        stdio: 'pipe',
        encoding: 'utf-8',
      });
      
      // Clean up expected command comparison (accounting for reg query format)
      // We just check if the output contains our exe path
      if (output.includes(this._exePath)) {
        return { success: true };
      }
      return { success: false, error: 'Verification failed: Path mismatch in registry' };
    } catch (err) {
      return { success: false, error: 'Verification failed: Could not read registry after write' };
    }
  }

  /**
   * Called on app launch to ensure consistency
   */
  verify(shouldBeEnabled) {
    if (!app.isPackaged) return;

    const status = this.checkStartupStatus();
    if (shouldBeEnabled && status !== 'Valid') {
      console.log('[StartupManager] Startup entry missing or broken, fixing...');
      this.enable();
    } else if (!shouldBeEnabled && status !== 'Missing') {
      console.log('[StartupManager] Startup entry found but disabled in config, removing...');
      this.disable();
    }
  }

  // legacy method for tray compatibility
  getStatus() {
    const status = this.checkStartupStatus();
    return {
      enabled: status === 'Valid',
      status: status
    };
  }
}

module.exports = new StartupManager();
