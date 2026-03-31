// ============================================================
// Music Widget — Expanded View
// Shows album art, track info, progress bar, and playback
// controls when the island is in expanded music mode.
// ============================================================

import React from 'react';
import { motion } from 'framer-motion';
import SoundWave from './SoundWave';

function MusicWidget({ mediaState, isPlaying, onPlayPause, onNext, onPrevious }) {
  if (!mediaState || mediaState.status === 'no_session') {
    return (
      <div className="music-widget music-empty">
        <div className="music-empty-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </div>
        <span className="music-empty-text">No media playing</span>
      </div>
    );
  }

  const progress =
    mediaState.duration > 0
      ? (mediaState.position / mediaState.duration) * 100
      : 0;

  return (
    <div className="music-widget">
      {/* Left side — Album art */}
      <motion.div className="music-art-container" layoutId="album-art">
        {mediaState.artwork ? (
          <img
            src={`data:image/jpeg;base64,${mediaState.artwork}`}
            alt="Album Art"
            className="music-art"
          />
        ) : (
          <div className="music-art music-art-placeholder">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
        )}

        {/* Subtle glow behind art when playing */}
        {isPlaying && <div className="music-art-glow" />}
      </motion.div>

      {/* Right side — Track info and controls */}
      <div className="music-info">
        <div className="music-text">
          <span className="music-title">{mediaState.title || 'Unknown Track'}</span>
          <span className="music-artist">{mediaState.artist || 'Unknown Artist'}</span>
        </div>

        {/* Progress bar */}
        <div className="music-progress-container">
          <div className="music-progress-bar">
            <motion.div
              className="music-progress-fill"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'linear' }}
            />
          </div>
          <div className="music-time">
            <span>{formatTime(mediaState.position)}</span>
            <span>{formatTime(mediaState.duration)}</span>
          </div>
        </div>

        {/* Playback controls */}
        <div className="music-controls">
          <button
            className="music-btn"
            onClick={(e) => { e.stopPropagation(); onPrevious(); }}
            title="Previous"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
            </svg>
          </button>

          <button
            className="music-btn music-btn-play"
            onClick={(e) => { e.stopPropagation(); onPlayPause(); }}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button
            className="music-btn"
            onClick={(e) => { e.stopPropagation(); onNext(); }}
            title="Next"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>

          {isPlaying && (
            <div className="music-wave-indicator">
              <SoundWave />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Format seconds to mm:ss
function formatTime(seconds) {
  if (!seconds || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default MusicWidget;
