import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

function SettingsWidget() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const s = await window.electronAPI.getStartupStatus();
      setStatus(s);
    } catch (err) {
      console.error('Failed to get startup status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleToggle = async () => {
    if (status?.isDev) return;
    setLoading(true);
    const result = await window.electronAPI.toggleStartup(!status.configEnabled);
    await fetchStatus();
  };

  const handleTest = async () => {
    await window.electronAPI.testStartup();
  };

  if (loading && !status) return <div className="settings-loading">Loading...</div>;

  return (
    <div className="settings-widget">
      <div className="settings-header">Settings</div>
      
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

      <div className="settings-section">
        <div className="settings-row">
          <div className="status-info">
            <div className="status-label">Registry Status:</div>
            <div className={`status-value ${status?.systemStatus === 'Valid' ? 'status-ok' : 'status-err'}`}>
              {status?.systemStatus || 'Unknown'}
            </div>
          </div>
          <button className="test-btn" onClick={handleTest}>Test Startup</button>
        </div>
      </div>
    </div>
  );
}

export default SettingsWidget;
