// ============================================================
// App Root — v3
// Handles media state with artwork caching, dominant color
// extraction with smooth transitions, and seek control.
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import DynamicIsland from './components/DynamicIsland';
import { extractDominantColor } from './utils/colorExtractor';

function App() {
  const [mediaState, setMediaState] = useState(null);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [mode, setMode] = useState('music');
  const [accentColor, setAccentColor] = useState('#ffffff');

  // Cache artwork so we don't lose it when receiving '__same__' sentinel
  const cachedArtworkRef = useRef(null);
  const lastColorArtRef = useRef(null);

  // ----------------------------------------------------------
  // Subscribe to media updates
  // ----------------------------------------------------------
  useEffect(() => {
    window.electronAPI?.getMediaState().then((state) => {
      if (state) handleMediaUpdate(state);
    });

    const unsub = window.electronAPI?.onMediaUpdate((state) => {
      handleMediaUpdate(state);
    });

    return () => unsub?.();
  }, []);

  // Process media updates — handle artwork caching
  const handleMediaUpdate = useCallback((state) => {
    if (!state) return;

    if (state.artwork === '__same__') {
      // Artwork unchanged — use cached version
      state.artwork = cachedArtworkRef.current;
    } else if (state.artwork && state.artwork.length > 10) {
      // New artwork — cache it and extract color
      cachedArtworkRef.current = state.artwork;

      if (state.artwork !== lastColorArtRef.current) {
        lastColorArtRef.current = state.artwork;
        extractDominantColor(state.artwork).then((color) => {
          setAccentColor(color.hex);
        });
      }
    } else if (!state.artwork || state.artwork.length < 10) {
      // No artwork — keep cache if same track
      if (cachedArtworkRef.current) {
        state.artwork = cachedArtworkRef.current;
      }
    }

    setMediaState({ ...state });
  }, []);

  // ----------------------------------------------------------
  // Subscribe to calendar
  // ----------------------------------------------------------
  useEffect(() => {
    window.electronAPI?.getCalendarEvents().then((events) => {
      if (events) setCalendarEvents(events);
    });

    const unsub = window.electronAPI?.onCalendarUpdate((events) => {
      setCalendarEvents(events || []);
    });

    return () => unsub?.();
  }, []);

  // ----------------------------------------------------------
  // Handlers
  // ----------------------------------------------------------
  const handlePlayPause = useCallback(() => {
    window.electronAPI?.mediaPlayPause();
  }, []);

  const handleNext = useCallback(() => {
    window.electronAPI?.mediaNext();
  }, []);

  const handlePrevious = useCallback(() => {
    window.electronAPI?.mediaPrevious();
  }, []);

  const handleSeek = useCallback((positionSeconds) => {
    window.electronAPI?.mediaSeek(positionSeconds);
  }, []);

  const handleOpenSource = useCallback(() => {
    if (mediaState?.source) {
      window.electronAPI?.openSourceApp(mediaState.source);
    }
  }, [mediaState?.source]);

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === 'music' ? 'calendar' : 'music'));
  }, []);

  return (
    <DynamicIsland
      mode={mode}
      mediaState={mediaState}
      calendarEvents={calendarEvents}
      accentColor={accentColor}
      onPlayPause={handlePlayPause}
      onNext={handleNext}
      onPrevious={handlePrevious}
      onSeek={handleSeek}
      onOpenSource={handleOpenSource}
      onToggleMode={toggleMode}
    />
  );
}

export default App;
