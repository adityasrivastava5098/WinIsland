import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

function SettingsWidget() {
  const [status, setStatus] = useState(null);
  const [calendarEnabled, setCalendarEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [displayMode, setDisplayMode] = useState('pill');

  const fetchStatus = async () => {
    try {
      const s = await window.electronAPI.getStartupStatus();
      const cal = await window.electronAPI.getCalendarStatus?.();
      setStatus(s);
      setCalendarEnabled(!!cal);
    } catch (err) {
      console.error('Failed to get startup status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    window.electronAPI?.getDisplayMode().then((mode) => {
      if (mode) setDisplayMode(mode);
    });
  }, []);

  const handleToggle = async () => {
    if (status?.isDev) return;
    setLoading(true);
    const result = await window.electronAPI.toggleStartup(!status.configEnabled);
    await fetchStatus();
  };

  const handleCalendarToggle = async () => {
    setLoading(true);
    await window.electronAPI.toggleCalendarIntegration?.(!calendarEnabled);
    await fetchStatus();
  };

  const handleTest = async () => {
    await window.electronAPI.testStartup();
  };

  const handleDisplayModeChange = async (mode) => {
    setDisplayMode(mode);
    await window.electronAPI?.setDisplayMode(mode);
  };

  if (loading && !status) return <div className="settings-loading">Loading...</div>;

  return (
    <div className="settings-widget">
      <div className="settings-header">Settings</div>
      
      {/* Display Mode Section */}
      <div className="settings-section">
        <div className="settings-section-label">Display Mode</div>
        <div className="display-mode-selector">
          <button
            className={`display-mode-btn ${displayMode === 'pill' ? 'display-mode-btn--active' : ''}`}
            onClick={() => handleDisplayModeChange('pill')}
          >
            <div className="display-mode-icon">
              <svg width="20" height="12" viewBox="0 0 20 12" fill="none">
                <rect x="1" y="1" width="18" height="10" rx="5" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
            <span className="display-mode-label">Pill</span>
          </button>
          <button
            className={`display-mode-btn ${displayMode === 'attached' ? 'display-mode-btn--active' : ''}`}
            onClick={() => handleDisplayModeChange('attached')}
          >
            <div className="display-mode-icon">
              <svg width="20" height="12" viewBox="0 0 20 12" fill="none">
                <path d="M1 0H19V7C19 9.76 16.76 12 14 12H6C3.24 12 1 9.76 1 7V0Z" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
            <span className="display-mode-label">Attached</span>
          </button>
        </div>
      </div>

      {/* Startup Section */}
      <div className="settings-section">
        <label className="settings-row">
          <span>Start with Windows</span>
          <div className="toggle-switch">
            <input 
              type="checkbox" 
              checked={status?.configEnabled || false} 
              disabled={status?.isDev}
              onChange={handleToggle}
            />
            <span className="slider"></span>
          </div>
        </label>
        {status?.isDev && (
          <div className="settings-warning">Startup only works in production build.</div>
        )}
      </div>

      {/* Calendar Integration Section */}
      <div className="settings-section">
        <label className="settings-row">
          <span>Enable Calendar Integration</span>
          <div className="toggle-switch">
            <input 
              type="checkbox" 
              checked={calendarEnabled} 
              onChange={handleCalendarToggle}
            />
            <span className="slider"></span>
          </div>
        </label>
      </div>
    </div>
  );
}

export default SettingsWidget;
