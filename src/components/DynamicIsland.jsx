// ============================================================
// Dynamic Island — Main UI Component (v3)
// Pure black pill. Click to expand, click outside to collapse.
// Collapsed: circular album art + color-synced waveform bars
// Expanded: full music player or calendar grid
// ============================================================

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MusicWidget from './MusicWidget';
import CalendarWidget from './CalendarWidget';
import SettingsWidget from './SettingsWidget';
import PrivacyWidget from './PrivacyWidget';
import SoundWave from './SoundWave';

const SPRING = { type: 'spring', stiffness: 380, damping: 28 };

function DynamicIsland({
  mode,
  displayMode = 'pill',
  mediaState,
  calendarEvents,
  privacyState,
  accentColor,
  onPlayPause,
  onNext,
  onPrevious,
  onSeek,
  onOpenSource,
  onToggleMode,
  onSetMode,
  onExpandRefresh,
  isCopied,
  clipboardType = 'generic',
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandSignal, setExpandSignal] = useState(0);
  const [shouldShowMedia, setShouldShowMedia] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [volume, setVolume] = useState(50);
  const [showVolume, setShowVolume] = useState(false);
  const volumeTimeoutRef = useRef(null);
  const islandRef = useRef(null);
  const lingerTimerRef = useRef(null);

  const isPlaying = mediaState?.playbackStatus === 'Playing';
  const hasMedia = mediaState && mediaState.status !== 'no_session';

  // ----------------------------------------------------------
  // Sync System Volume
  // ----------------------------------------------------------
  useEffect(() => {
    const unsub = window.electronAPI?.onVolumeUpdate?.((vol) => {
      setVolume(vol);
      if (!isExpanded) {
        setShowVolume(true);
        if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
        volumeTimeoutRef.current = setTimeout(() => {
          setShowVolume(false);
        }, 1500);
      }
    });
    return () => unsub?.();
  }, [isExpanded]);

  // ----------------------------------------------------------
  // Linger logic: keep music pill for 1 min after playback stops/pauses
  // ----------------------------------------------------------
  useEffect(() => {
    if (isPlaying) {
      setShouldShowMedia(true);
      if (lingerTimerRef.current) {
        clearTimeout(lingerTimerRef.current);
        lingerTimerRef.current = null;
      }
    } else if (hasMedia && shouldShowMedia) {
      // If paused, shrink back to circle after 60 seconds of inactivity
      if (!lingerTimerRef.current) {
        lingerTimerRef.current = setTimeout(() => {
          setShouldShowMedia(false);
          lingerTimerRef.current = null;
        }, 60000); // 1 minute
      }
    } else if (!hasMedia) {
      // No session: shrink immediately
      setShouldShowMedia(false);
      if (lingerTimerRef.current) {
        clearTimeout(lingerTimerRef.current);
        lingerTimerRef.current = null;
      }
    }
  }, [isPlaying, hasMedia]);

  // ----------------------------------------------------------
  // Interactions: Click-outside and Window Blur
  // ----------------------------------------------------------
  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = (e) => {
      if (islandRef.current && !islandRef.current.contains(e.target)) {
        setIsExpanded(false);
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true);
    }, 150);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [isExpanded]);

  useEffect(() => {
    if (!isExpanded) return;
    const handleBlur = () => setIsExpanded(false);
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [isExpanded]);

  // ----------------------------------------------------------
  // Dimensions and Mouse Interaction
  // ----------------------------------------------------------
  const isAttached = displayMode === 'attached';

  const dimensions = useMemo(() => {
    if (isExpanded) {
      return {
        width: 360,
        height: 200,
        borderRadius: isAttached ? '0px 0px 32px 32px' : '32px',
      };
    }
    
    // If scrolling volume, show 200px pill
    if (showVolume) {
      return {
        width: 200,
        height: 40,
        borderRadius: isAttached ? '0px 0px 20px 20px' : '20px',
      };
    }
    
    // If copied and not expanded, show 160px pill (expands from 40 if idle)
    if (isCopied) {
      return {
        width: 160,
        height: 40,
        borderRadius: isAttached ? '0px 0px 20px 20px' : '20px',
      };
    }
    
    // Collapsed: show 160px pill if media active, or 40px circle if idle
    const w = shouldShowMedia ? 160 : 40;
    return {
      width: w,
      height: 40,
      borderRadius: isAttached ? '0px 0px 20px 20px' : '20px',
    };
  }, [isExpanded, shouldShowMedia, isAttached, isCopied, showVolume]);

  useEffect(() => {
    if (isExpanded) {
      window.electronAPI?.setIgnoreMouseEvents(false);
    } else {
      window.electronAPI?.setIgnoreMouseEvents(true, { forward: true });
    }
  }, [isExpanded]);

  const collapse = useCallback(() => setIsExpanded(false), []);

  // ----------------------------------------------------------
  // Collapsed content
  // ----------------------------------------------------------
  const renderCollapsed = () => {
    if (showVolume) {
      let icon = null;
      if (volume === 0) {
        icon = (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <line x1="23" y1="9" x2="17" y2="15"></line>
            <line x1="17" y1="9" x2="23" y2="15"></line>
          </svg>
        );
      } else if (volume < 33) {
        icon = (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M15 9a5 5 0 0 1 0 6"></path>
          </svg>
        );
      } else if (volume < 66) {
        icon = (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M15 9a5 5 0 0 1 0 6"></path>
            <path d="M18 7a9 9 0 0 1 0 10"></path>
          </svg>
        );
      } else {
        icon = (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M15 9a5 5 0 0 1 0 6"></path>
            <path d="M18 7a9 9 0 0 1 0 10"></path>
            <path d="M21 5a13 13 0 0 1 0 14"></path>
          </svg>
        );
      }

      return (
        <motion.div
          key="volume"
          className="island-collapsed-content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{ justifyContent: 'flex-start', paddingLeft: '10px' }}
        >
          <div className="island-thumb-circle" style={{ background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '12px', width: '28px', height: '28px' }}>
            {icon}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginRight: '12px', pointerEvents: 'none', justifyContent: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ color: '#fff', fontSize: '12px', fontWeight: '500', letterSpacing: '-0.2px' }}>Volume</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: '500' }}>{Math.round(volume)}%</span>
            </div>
            <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.15)', borderRadius: '1.5px', overflow: 'hidden' }}>
              <div style={{ width: `${volume}%`, height: '100%', background: '#fff', borderRadius: '1.5px', transition: 'width', transitionDuration: '0.1s' }} />
            </div>
          </div>
        </motion.div>
      );
    }

    if (isCopied) {
      let icon = null;
      let subtitle = "Content copied";
      
      switch (clipboardType) {
        case 'text':
          icon = (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          );
          subtitle = "Text copied";
          break;
        case 'file':
          icon = (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
          );
          subtitle = "File copied";
          break;
        case 'image':
          icon = (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          );
          subtitle = "Image copied";
          break;
        default:
          icon = (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          );
          subtitle = "Copied";
      }

      return (
        <motion.div
          key="copied"
          className="island-collapsed-content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{ justifyContent: 'flex-start', paddingLeft: '10px' }}
        >
          <div className="island-thumb-circle" style={{ background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '8px' }}>
            {icon}
          </div>

          <div className="island-pill-info" style={{ pointerEvents: 'none' }}>
            <span className="pill-title">Copied</span>
            <span className="pill-artist">{subtitle}</span>
          </div>
        </motion.div>
      );
    }

    if (shouldShowMedia) {
      return (
        <motion.div
          key="pill"
          className="island-collapsed-content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Circular artwork or placeholder */}
          {mediaState?.artwork && mediaState.artwork.length > 20 ? (
            <img
              src={`data:image/jpeg;base64,${mediaState.artwork}`}
              alt=""
              className="island-thumb-circle"
              style={{ pointerEvents: 'none' }}
            />
          ) : (
            <div className="island-thumb-circle island-thumb-placeholder" style={{ pointerEvents: 'none' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
          )}

          {/* On Hov: Show Track Info. Off Hov: Show Waveform */}
          <AnimatePresence mode="wait">
            {isHovered ? (
              <motion.div
                key="info"
                className="island-pill-info"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
                style={{ pointerEvents: 'none' }}
              >
                <span className="pill-title">{mediaState?.title || 'Unknown'}</span>
                <span className="pill-artist">{mediaState?.artist || 'Unknown'}</span>
              </motion.div>
            ) : (
              <motion.div
                key="waveform"
                className="island-pill-visuals"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', alignItems: 'center', width: '100%', height: '100%', pointerEvents: 'none' }}
              >
                <div className="island-collapsed-spacer" />
                {isPlaying ? (
                  <SoundWave color={accentColor} size="large" />
                ) : (
                  <div className="island-idle-dot" style={{ opacity: 0.6 }} />
                )}
              </motion.div>
            )}
          </AnimatePresence>

        </motion.div>
      );
    }

    // Small Circle (Idle State)
    return (
      <motion.div
        key="circle"
        className="island-collapsed-content island-idle"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        style={{ width: '40px', justifyContent: 'center', padding: 0, position: 'relative' }}
      >
        <div className="island-idle-dot" />

      </motion.div>
    );
  };

  const hasCamera = privacyState?.camera?.length > 0;
  const hasMic = privacyState?.microphone?.length > 0;

  const renderIndicator = (type, color) => {
    return (
      <motion.div
        key={`indicator-${type}`}
        layout
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          backgroundColor: '#000000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: isAttached ? '0 4px 12px rgba(0,0,0,0.5)' : '0 2px 8px rgba(0,0,0,0.6)',
          zIndex: 10,
          marginTop: isAttached ? '6px' : '6px', // Align roughly with the center of the 40px island
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSetMode(`privacy-${type}`);
          if (!isExpanded) {
            onExpandRefresh?.();
            setExpandSignal((n) => n + 1);
            setIsExpanded(true);
          }
        }}
      >
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
      </motion.div>
    );
  };

  const handleWheel = (e) => {
    if (isExpanded) return;
    
    setShowVolume(true);
    
    setVolume((prev) => {
      const next = Math.max(0, Math.min(100, Math.round(prev) + (e.deltaY < 0 ? 5 : -5)));
      window.electronAPI?.setVolume(next);
      return next;
    });

    if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
    volumeTimeoutRef.current = setTimeout(() => {
      setShowVolume(false);
    }, 1500); // 1.5 seconds hold
  };

  return (
    <div className={`island-container ${isAttached ? 'island-container--attached' : 'island-container--pill'}`}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', justifyContent: 'center' }}>
        <motion.div
          ref={islandRef}
          className={`island ${isExpanded ? 'expanded' : 'collapsed'} ${isAttached ? 'island--attached' : 'island--pill'}`}
        layout
        onWheel={handleWheel}
        animate={{
          width: dimensions.width,
          height: dimensions.height,
          borderRadius: dimensions.borderRadius,
        }}
        transition={SPRING}
        onClick={() => {
          if (!isExpanded) {
            // Reset to music mode if opening
            if (mode !== 'music') onToggleMode();
            onExpandRefresh?.();
            setExpandSignal((n) => n + 1);
            setIsExpanded(true);
          }
        }}
        onMouseEnter={() => {
          setIsHovered(true);
          window.electronAPI?.setIgnoreMouseEvents(false);
          window.electronAPI?.getVolume().then((vol) => {
            if (vol !== undefined && vol >= 0) setVolume(vol);
          });
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          if (!isExpanded) window.electronAPI?.setIgnoreMouseEvents(true, { forward: true });
        }}
        style={{ cursor: isExpanded ? 'default' : 'pointer' }}
      >
        {/* Accent glow */}
        <div
          className="island-glow"
          style={{
            '--glow-color': isPlaying && accentColor !== '#ffffff' ? accentColor : 'transparent',
          }}
        />

        <AnimatePresence mode="wait">
          {isExpanded ? (
            <motion.div
              key="expanded"
              className="island-expanded-content"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.2 }}
            >
              {mode === 'music' ? (
                <MusicWidget
                  mediaState={mediaState}
                  isPlaying={isPlaying}
                  expandSignal={expandSignal}
                  accentColor={accentColor}
                  onPlayPause={onPlayPause}
                  onNext={onNext}
                  onPrevious={onPrevious}
                  onSeek={onSeek}
                  onOpenSource={onOpenSource}
                />
              ) : mode === 'calendar' ? (
                <CalendarWidget events={calendarEvents} />
              ) : mode.startsWith('privacy') ? (
                <PrivacyWidget privacyState={privacyState} type={mode.split('-')[1] || 'all'} />
              ) : (
                <SettingsWidget />
              )}

              {/* Mode toggle */}
              <button
                className="island-mode-toggle"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMode();
                }}
                title={mode === 'music' ? 'To Calendar' : mode === 'calendar' ? 'To Settings' : mode.startsWith('privacy') ? 'Back to Music' : 'To Music'}
              >
                {mode === 'music' ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                ) : mode === 'calendar' ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                ) : mode.startsWith('privacy') ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                )}
              </button>
            </motion.div>
          ) : (
            <React.Fragment key="collapsed">{renderCollapsed()}</React.Fragment>
          )}
        </AnimatePresence>
      </motion.div>

        {/* Separate Privacy Indicators */}
        <AnimatePresence>
          {!isExpanded && hasCamera && renderIndicator('camera', '#34C759')}
          {!isExpanded && hasMic && renderIndicator('microphone', '#FF9500')}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default DynamicIsland;
