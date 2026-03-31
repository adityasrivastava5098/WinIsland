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
import SoundWave from './SoundWave';

const SPRING = { type: 'spring', stiffness: 380, damping: 28 };

function DynamicIsland({
  mode,
  mediaState,
  calendarEvents,
  accentColor,
  onPlayPause,
  onNext,
  onPrevious,
  onSeek,
  onOpenSource,
  onToggleMode,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const islandRef = useRef(null);

  const isPlaying = mediaState?.playbackStatus === 'Playing';
  const hasMedia = mediaState && mediaState.status !== 'no_session';

  // ----------------------------------------------------------
  // Click-outside: detect clicks on the transparent body
  // ----------------------------------------------------------
  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = (e) => {
      if (islandRef.current && !islandRef.current.contains(e.target)) {
        setIsExpanded(false);
      }
    };

    // Small delay to prevent the expand-click from immediately triggering collapse
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true);
    }, 150);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [isExpanded]);

  // Also collapse on window blur (user clicked outside the Electron window)
  useEffect(() => {
    if (!isExpanded) return;

    const handleBlur = () => setIsExpanded(false);
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [isExpanded]);

  // Dynamic dimensions
  const dimensions = useMemo(() => {
    if (isExpanded) {
      return { width: 360, height: 200, borderRadius: 32 };
    }
    return { width: hasMedia ? 200 : 120, height: 40, borderRadius: 20 };
  }, [isExpanded, hasMedia]);

  // Collapse handler
  const collapse = useCallback(() => setIsExpanded(false), []);

  // ----------------------------------------------------------
  // Collapsed content
  // ----------------------------------------------------------
  const renderCollapsed = () => {
    if (hasMedia) {
      return (
        <motion.div
          className="island-collapsed-content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Circular album art */}
          {mediaState.artwork && mediaState.artwork.length > 20 ? (
            <img
              src={`data:image/jpeg;base64,${mediaState.artwork}`}
              alt=""
              className="island-thumb-circle"
            />
          ) : (
            <div className="island-thumb-circle island-thumb-placeholder">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
          )}

          <div className="island-collapsed-spacer" />

          {/* Sound wave — colored by dominant album color */}
          {isPlaying && <SoundWave color={accentColor} size="large" />}
        </motion.div>
      );
    }

    return (
      <motion.div
        className="island-collapsed-content island-idle"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="island-idle-dot" />
      </motion.div>
    );
  };

  return (
    <div className="island-container">
      <motion.div
        ref={islandRef}
        className={`island ${isExpanded ? 'expanded' : 'collapsed'}`}
        layout
        animate={{
          width: dimensions.width,
          height: dimensions.height,
          borderRadius: dimensions.borderRadius,
        }}
        transition={SPRING}
        onClick={() => {
          if (!isExpanded) setIsExpanded(true);
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
                  accentColor={accentColor}
                  onPlayPause={onPlayPause}
                  onNext={onNext}
                  onPrevious={onPrevious}
                  onSeek={onSeek}
                  onOpenSource={onOpenSource}
                />
              ) : (
                <CalendarWidget events={calendarEvents} />
              )}

              {/* Mode toggle */}
              <button
                className="island-mode-toggle"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMode();
                }}
                title={mode === 'music' ? 'Calendar' : 'Music'}
              >
                {mode === 'music' ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
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
