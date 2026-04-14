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
import SoundWave from './SoundWave';

const SPRING = { type: 'spring', stiffness: 380, damping: 28 };

function DynamicIsland({
  mode,
  displayMode = 'pill',
  mediaState,
  calendarEvents,
  accentColor,
  onPlayPause,
  onNext,
  onPrevious,
  onSeek,
  onOpenSource,
  onToggleMode,
  onExpandRefresh,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandSignal, setExpandSignal] = useState(0);
  const [shouldShowMedia, setShouldShowMedia] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const islandRef = useRef(null);
  const lingerTimerRef = useRef(null);

  const isPlaying = mediaState?.playbackStatus === 'Playing';
  const hasMedia = mediaState && mediaState.status !== 'no_session';

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
    // Collapsed: show 160px pill if media active, or 40px circle if idle
    const w = shouldShowMedia ? 160 : 40;
    return {
      width: w,
      height: 40,
      borderRadius: isAttached ? '0px 0px 20px 20px' : '20px',
    };
  }, [isExpanded, shouldShowMedia, isAttached]);

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
        style={{ width: '40px', justifyContent: 'center', padding: 0 }}
      >
        <div className="island-idle-dot" />
      </motion.div>
    );
  };

  return (
    <div className={`island-container ${isAttached ? 'island-container--attached' : 'island-container--pill'}`}>
      <motion.div
        ref={islandRef}
        className={`island ${isExpanded ? 'expanded' : 'collapsed'} ${isAttached ? 'island--attached' : 'island--pill'}`}
        layout
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
                title={mode === 'music' ? 'To Calendar' : mode === 'calendar' ? 'To Settings' : 'To Music'}
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
    </div>
  );
}

export default DynamicIsland;
