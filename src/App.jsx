// ============================================================
// App Root
// Manages global state (media, calendar, active mode),
// extracts dominant color from album art, and renders
// the DynamicIsland component with live data.
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import DynamicIsland from './components/DynamicIsland';
import { extractDominantColor } from './utils/colorExtractor';

function App() {
  const [mediaState, setMediaState] = useState(null);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [mode, setMode] = useState('music'); // 'music' | 'calendar'
  const [accentColor, setAccentColor] = useState('#ffffff');

  // Track the last artwork we extracted color from to avoid redundant work
  const lastArtworkRef = useRef(null);

  // ----------------------------------------------------------
  // Subscribe to real-time media updates from the main process
  // ----------------------------------------------------------
  useEffect(() => {
    // Get initial state
    window.electronAPI?.getMediaState().then((state) => {
      if (state) setMediaState(state);
    });

    // Listen for live updates
    const unsub = window.electronAPI?.onMediaUpdate((state) => {
      setMediaState(state);
    });

    return () => unsub?.();
  }, []);

  // ----------------------------------------------------------
  // Extract dominant color whenever artwork changes
  // ----------------------------------------------------------
  useEffect(() => {
    const artwork = mediaState?.artwork;
    if (!artwork || artwork === lastArtworkRef.current) return;
    lastArtworkRef.current = artwork;

    extractDominantColor(artwork).then((color) => {
      setAccentColor(color.hex);
    });
  }, [mediaState?.artwork]);

  // ----------------------------------------------------------
  // Subscribe to calendar event updates
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
  // Media control handlers (forwarded to main process via IPC)
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

  // ----------------------------------------------------------
  // Open the source app (click on album art)
  // ----------------------------------------------------------
  const handleOpenSource = useCallback(() => {
    if (mediaState?.source) {
      window.electronAPI?.openSourceApp(mediaState.source);
    }
  }, [mediaState?.source]);

  // ----------------------------------------------------------
  // Toggle between music and calendar modes
  // ----------------------------------------------------------
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
      onOpenSource={handleOpenSource}
      onToggleMode={toggleMode}
    />
  );
}

export default App;
