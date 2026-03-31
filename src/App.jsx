// ============================================================
// App Root
// Manages global state (media, calendar, active mode) and
// renders the DynamicIsland component with live data.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import DynamicIsland from './components/DynamicIsland';

function App() {
  const [mediaState, setMediaState] = useState(null);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [mode, setMode] = useState('music'); // 'music' | 'calendar'

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
      onPlayPause={handlePlayPause}
      onNext={handleNext}
      onPrevious={handlePrevious}
      onToggleMode={toggleMode}
    />
  );
}

export default App;
