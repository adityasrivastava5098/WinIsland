import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

function PrivacyWidget({ privacyState, type = 'all' }) {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    window.electronAPI?.getPrivacyStatus().then((status) => {
      setEnabled(status);
    });
  }, []);

  const handleToggle = () => {
    const newVal = !enabled;
    setEnabled(newVal);
    window.electronAPI?.togglePrivacyIndicators(newVal);
  };

  const hasActivity = 
    (type === 'all' || type === 'camera') && privacyState.camera?.length > 0 || 
    (type === 'all' || type === 'microphone') && privacyState.microphone?.length > 0;

  const formatDuration = (timestamp) => {
    if (!timestamp) return 'Just now';
    
    const diff = Math.floor((Date.now() - timestamp) / 1000); // in seconds
    if (diff < 0) return 'Just now';
    
    const hours = Math.floor(diff / 3600);
    const mins = Math.floor((diff % 3600) / 60);
    const secs = diff % 60;
    
    const hStr = hours.toString().padStart(2, '0');
    const mStr = mins.toString().padStart(2, '0');
    const sStr = secs.toString().padStart(2, '0');
    
    if (hours > 0) return `${hStr}:${mStr}:${sStr}`;
    return `00:${mStr}:${sStr}`;
  };

  const renderActiveItems = (items, itemType, color) => {
    if (!items || items.length === 0) return null;
    return items.slice(0, 2).map((item, idx) => (
      <div key={`${itemType}-${idx}`} className="privacy-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
          <span style={{ fontSize: '14px', fontWeight: '500', color: '#fff' }}>{item.app}</span>
        </div>
        <div style={{ fontSize: '12px', color: '#aaa', fontVariantNumeric: 'tabular-nums' }}>
          {formatDuration(item.timestamp)}
        </div>
      </div>
    ));
  };

  const getTitle = () => {
    if (type === 'camera') return 'Using Camera';
    if (type === 'microphone') return 'Using Microphone';
    return 'Privacy';
  };

  return (
    <motion.div
      className="privacy-widget"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      style={{ padding: '20px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#fff' }}>{getTitle()}</h3>
        {type === 'all' && (
          <label className="switch" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <span style={{ fontSize: '12px', color: '#aaa' }}>{enabled ? 'ON' : 'OFF'}</span>
            <input
              type="checkbox"
              checked={enabled}
              onChange={handleToggle}
              style={{ display: 'none' }}
            />
            <div
              style={{
                width: '32px',
                height: '18px',
                backgroundColor: enabled ? '#34C759' : '#333',
                borderRadius: '9px',
                position: 'relative',
                transition: 'background-color 0.2s',
              }}
            >
              <div
                style={{
                  width: '14px',
                  height: '14px',
                  backgroundColor: '#fff',
                  borderRadius: '50%',
                  position: 'absolute',
                  top: '2px',
                  left: enabled ? '16px' : '2px',
                  transition: 'left 0.2s',
                }}
              />
            </div>
          </label>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!enabled ? (
          <div style={{ display: 'flex', height: '100%', justifyContent: 'center', alignItems: 'center', color: '#666', fontSize: '14px', textAlign: 'center' }}>
            Privacy indicators are disabled.
          </div>
        ) : !hasActivity ? (
          <div style={{ display: 'flex', height: '100%', justifyContent: 'center', alignItems: 'center', color: '#666', fontSize: '14px', textAlign: 'center' }}>
            No apps are currently using<br/>the {type === 'all' ? 'camera or microphone' : type}.
          </div>
        ) : (
          <div>
            {(type === 'all' || type === 'camera') && renderActiveItems(privacyState.camera, 'camera', '#34C759')}
            {(type === 'all' || type === 'microphone') && renderActiveItems(privacyState.microphone, 'mic', '#FF9500')}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default PrivacyWidget;
