// ============================================================
// Dynamic Island — Main UI Component
// The pill-shaped overlay that expands/collapses with smooth
// animations. Shows either music or calendar content based on
// the active mode. Handles hover and click interactions.
// ============================================================

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MusicWidget from './MusicWidget';
import CalendarWidget from './CalendarWidget';
import SoundWave from './SoundWave';

// Spring animation config for that satisfying Apple-like bounce
const SPRING = { type: 'spring', stiffness: 400, damping: 30 };

function DynamicIsland({
  mode,
  mediaState,
  calendarEvents,
  onPlayPause,
  onNext,
  onPrevious,
  onToggleMode,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Determine if music is actively playing
  const isPlaying = mediaState?.playbackStatus === 'Playing';
  const hasMedia = mediaState && mediaState.status !== 'no_session';

  // Derive the visual state: collapsed, peek (hovered), or expanded
  const visualState = isExpanded ? 'expanded' : isHovered ? 'peek' : 'collapsed';

  // Dynamic dimensions based on visual state
  const dimensions = useMemo(() => {
    switch (visualState) {
      case 'expanded':
        return { width: 340, height: 180, borderRadius: 28 };
      case 'peek':
        return { width: 260, height: 42, borderRadius: 21 };
      case 'collapsed':
      default:
        return { width: 190, height: 36, borderRadius: 18 };
    }
  }, [visualState]);

  // Build the collapsed pill content (minimal info)
  const collapsedContent = () => {
    if (hasMedia && mode === 'music') {
      return (
        <motion.div
          className="island-collapsed-content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Album art thumbnail */}
          {mediaState.artwork ? (
            <motion.img
              src={`data:image/jpeg;base64,${mediaState.artwork}`}
              alt="Album Art"
              className="island-thumb"
              layoutId="album-art"
            />
          ) : (
            <motion.div className="island-thumb island-thumb-placeholder" layoutId="album-art">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </motion.div>
          )}

          {/* Scrolling title */}
          <div className="island-collapsed-text">
            <span className="island-collapsed-title">{mediaState.title || 'Unknown'}</span>
          </div>

          {/* Sound wave animation when playing */}
          {isPlaying && <SoundWave />}
        </motion.div>
      );
    }

    if (calendarEvents.length > 0 && mode === 'calendar') {
      const next = calendarEvents[0];
      const timeLeft = getTimeRemaining(next.start);
      return (
        <motion.div
          className="island-collapsed-content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="island-calendar-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div className="island-collapsed-text">
            <span className="island-collapsed-title">{next.title}</span>
          </div>
          <span className="island-time-badge">{timeLeft}</span>
        </motion.div>
      );
    }

    // Default idle state — just the pill with a subtle glow
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
        className={`island ${visualState}`}
        layout
        animate={{
          width: dimensions.width,
          height: dimensions.height,
          borderRadius: dimensions.borderRadius,
        }}
        transition={SPRING}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        onClick={() => setIsExpanded((prev) => !prev)}
        style={{ cursor: 'pointer' }}
      >
        {/* Glossy edge highlight */}
        <div className="island-shine" />

        <AnimatePresence mode="wait">
          {isExpanded ? (
            <motion.div
              key="expanded"
              className="island-expanded-content"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
            >
              {mode === 'music' ? (
                <MusicWidget
                  mediaState={mediaState}
                  isPlaying={isPlaying}
                  onPlayPause={onPlayPause}
                  onNext={onNext}
                  onPrevious={onPrevious}
                />
              ) : (
                <CalendarWidget events={calendarEvents} />
              )}

              {/* Mode toggle button */}
              <button
                className="island-mode-toggle"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMode();
                }}
                title={mode === 'music' ? 'Switch to Calendar' : 'Switch to Music'}
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
            <React.Fragment key="collapsed">{collapsedContent()}</React.Fragment>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// Helper: calculate human-readable time remaining until an event
function getTimeRemaining(isoString) {
  const now = new Date();
  const target = new Date(isoString);
  const diffMs = target - now;

  if (diffMs <= 0) return 'now';

  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m`;

  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hours}h ${remainMins}m` : `${hours}h`;
}

export default DynamicIsland;
