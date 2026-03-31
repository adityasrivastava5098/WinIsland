// ============================================================
// Music Widget — Expanded View (Redesigned)
// Matches iPhone Dynamic Island reference:
//   - Album art (left, clickable to open source app)
//   - Title + artist (right)
//   - Link icon (top right)
//   - Full-width seekbar with current/total time
//   - Centered playback controls (prev | play/pause | next)
// ============================================================

import React from 'react';
import { motion } from 'framer-motion';

function MusicWidget({
  mediaState,
  isPlaying,
  accentColor = '#ffffff',
  onPlayPause,
  onNext,
  onPrevious,
  onOpenSource,
}) {
  if (!mediaState || mediaState.status === 'no_session') {
    return (
      <div className="music-widget music-empty">
        <div className="music-empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
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

  // Determine friendly source name
  const sourceName = getSourceName(mediaState.source);

  return (
    <div className="music-widget">
      {/* Top row: album art + track info + link icon */}
      <div className="music-top-row">
        {/* Album art — clickable to open source app */}
        <div
          className="music-art-container"
          onClick={(e) => { e.stopPropagation(); onOpenSource?.(); }}
          title={`Open ${sourceName}`}
          style={{ cursor: 'pointer' }}
        >
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
          {isPlaying && (
            <div
              className="music-art-glow"
              style={{ background: `${accentColor}40` }}
            />
          )}
        </div>

        {/* Track info */}
        <div className="music-info">
          <span className="music-title">{mediaState.title || 'Unknown Track'}</span>
          <span className="music-artist">{mediaState.artist || 'Unknown Artist'}</span>
        </div>

        {/* Link/source icon */}
        <button
          className="music-link-btn"
          onClick={(e) => { e.stopPropagation(); onOpenSource?.(); }}
          title={`Open in ${sourceName}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </button>
      </div>

      {/* Seekbar — full width */}
      <div className="music-seekbar-container">
        <div className="music-seekbar-track">
          <motion.div
            className="music-seekbar-fill"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: 'linear' }}
            style={{ background: accentColor !== '#ffffff' ? accentColor : '#fff' }}
          />
          {/* Seekbar thumb */}
          <motion.div
            className="music-seekbar-thumb"
            animate={{ left: `${progress}%` }}
            transition={{ duration: 0.8, ease: 'linear' }}
          />
        </div>
        <div className="music-time">
          <span>{formatTime(mediaState.position)}</span>
          <span>{formatTime(mediaState.duration)}</span>
        </div>
      </div>

      {/* Playback controls — centered */}
      <div className="music-controls">
        <button
          className="music-btn"
          onClick={(e) => { e.stopPropagation(); onPrevious(); }}
          title="Previous"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
          </svg>
        </button>

        <button
          className="music-btn music-btn-play"
          onClick={(e) => { e.stopPropagation(); onPlayPause(); }}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <button
          className="music-btn"
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          title="Next"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
          </svg>
        </button>
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

// Map SMTC source app ID to friendly name
function getSourceName(source) {
  if (!source) return 'Media Player';
  const s = source.toLowerCase();
  if (s.includes('spotify')) return 'Spotify';
  if (s.includes('apple') || s.includes('itunes')) return 'Apple Music';
  if (s.includes('chrome')) return 'Chrome';
  if (s.includes('edge') || s.includes('msedge')) return 'Edge';
  if (s.includes('firefox')) return 'Firefox';
  if (s.includes('vlc')) return 'VLC';
  if (s.includes('zunemusic') || s.includes('groove')) return 'Groove Music';
  return 'Media Player';
}

export default MusicWidget;
