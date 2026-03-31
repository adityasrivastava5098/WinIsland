// ============================================================
// Music Widget — Expanded View (v3)
// Clean design:
//   - Album art (left, clickable → opens source app)
//   - Title + artist (right)
//   - Interactive seekbar (drag to seek)
//   - Centered playback controls
// NO link icon. Minimal and premium.
// ============================================================

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';

function MusicWidget({
  mediaState,
  isPlaying,
  accentColor = '#ffffff',
  onPlayPause,
  onNext,
  onPrevious,
  onSeek,
  onOpenSource,
}) {
  const seekTrackRef = useRef(null);
  const lastTrackKeyRef = useRef('');
  const lastIsPlayingRef = useRef(isPlaying);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPreview, setSeekPreview] = useState(null);
  const [displayPosition, setDisplayPosition] = useState(0);

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

  const duration = mediaState.duration || 0;
  const mediaPosition = mediaState.position || 0;
  const position = isSeeking ? (seekPreview || 0) : displayPosition;
  const progress = duration > 0 ? (position / duration) * 100 : 0;
  const barColor = accentColor !== '#ffffff' ? accentColor : '#fff';

  // Sync from media updates with monotonic playback behavior.
  useEffect(() => {
    if (isSeeking) return;

    const trackKey = `${mediaState.source || ''}|${mediaState.title || ''}|${mediaState.artist || ''}|${duration}`;
    const trackChanged = trackKey !== lastTrackKeyRef.current;

    if (trackChanged) {
      lastTrackKeyRef.current = trackKey;
      setDisplayPosition(clampPosition(mediaPosition, duration));
      return;
    }

    if (!isPlaying) {
      setDisplayPosition(clampPosition(mediaPosition, duration));
      return;
    }

    setDisplayPosition((prev) => {
      // Forced monotonic mode during playback:
      // never move backward from backend poll noise.
      if (mediaPosition <= prev) return prev;
      return clampPosition(mediaPosition, duration);
    });
  }, [mediaState.source, mediaState.title, mediaState.artist, duration, mediaPosition, isPlaying, isSeeking]);

  // Explicit resets on pause/resume boundaries.
  useEffect(() => {
    const wasPlaying = lastIsPlayingRef.current;
    if (wasPlaying !== isPlaying && !isSeeking) {
      setDisplayPosition(clampPosition(mediaPosition, duration));
    }
    lastIsPlayingRef.current = isPlaying;
  }, [isPlaying, isSeeking, mediaPosition, duration]);

  // Advance exactly once per second while playing.
  useEffect(() => {
    if (isSeeking || !isPlaying || duration <= 0) return undefined;

    const timer = setInterval(() => {
      setDisplayPosition((prev) => {
        const next = prev + 1;
        return next > duration ? duration : next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isSeeking, isPlaying, duration]);

  function clampPosition(value, maxDuration) {
    if (!Number.isFinite(value) || value < 0) return 0;
    if (!maxDuration || maxDuration <= 0) return value;
    return value > maxDuration ? maxDuration : value;
  }

  // ----------------------------------------------------------
  // Interactive seekbar handlers
  // ----------------------------------------------------------
  const getSeekPosition = useCallback((clientX) => {
    if (!seekTrackRef.current || !duration) return 0;
    const rect = seekTrackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * duration;
  }, [duration]);

  const handleSeekStart = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsSeeking(true);
    const pos = getSeekPosition(e.clientX);
    setSeekPreview(pos);

    const handleMove = (ev) => {
      const p = getSeekPosition(ev.clientX);
      setSeekPreview(p);
    };

    const handleUp = (ev) => {
      const p = getSeekPosition(ev.clientX);
      setIsSeeking(false);
      setSeekPreview(null);
      setDisplayPosition(clampPosition(p, duration));
      onSeek?.(p);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [getSeekPosition, onSeek]);

  // Source name for tooltip
  const sourceName = getSourceName(mediaState.source);

  return (
    <div className="music-widget">
      {/* Top row: album art + track info */}
      <div className="music-top-row">
        {/* Album art — click to open source app */}
        <div
          className="music-art-container"
          onClick={(e) => { e.stopPropagation(); onOpenSource?.(); }}
          title={`Open ${sourceName}`}
          style={{ cursor: 'pointer' }}
        >
          {mediaState.artwork && mediaState.artwork.length > 20 ? (
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

          {/* Accent glow behind art */}
          {isPlaying && (
            <div
              className="music-art-glow"
              style={{ background: `${barColor}40` }}
            />
          )}
        </div>

        {/* Track info */}
        <div className="music-info">
          <span className="music-title">{mediaState.title || 'Unknown Track'}</span>
          <span className="music-artist">{mediaState.artist || 'Unknown Artist'}</span>
        </div>
      </div>

      {/* Interactive seekbar */}
      <div className="music-seekbar-container">
        <div
          ref={seekTrackRef}
          className="music-seekbar-track"
          onMouseDown={handleSeekStart}
          style={{ cursor: 'pointer' }}
        >
          <motion.div
            className="music-seekbar-fill"
            style={{
              width: `${progress}%`,
              background: barColor,
            }}
          />
          <motion.div
            className="music-seekbar-thumb"
            style={{ left: `${progress}%` }}
          />
        </div>
        <div className="music-time">
          <span>{formatTime(position)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Centered playback controls */}
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

function formatTime(seconds) {
  if (!seconds || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getSourceName(source) {
  if (!source) return 'Media Player';
  const s = source.toLowerCase();
  if (s.includes('spotify')) return 'Spotify';
  if (s.includes('apple') || s.includes('itunes')) return 'Apple Music';
  if (s.includes('chrome')) return 'Chrome';
  if (s.includes('edge') || s.includes('msedge')) return 'Edge';
  if (s.includes('firefox')) return 'Firefox';
  if (s.includes('vlc')) return 'VLC';
  if (s.includes('zunemusic') || s.includes('groove')) return 'Groove';
  return 'Media Player';
}

export default MusicWidget;
