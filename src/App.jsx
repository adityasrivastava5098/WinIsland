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
  const [privacyState, setPrivacyState] = useState({ camera: [], microphone: [] });
  const [mode, setMode] = useState('music'); // 'music' | 'calendar' | 'privacy'
  const [accentColor, setAccentColor] = useState('#ffffff');
  const [displayMode, setDisplayMode] = useState('pill'); // 'pill' | 'attached'

  // Cache artwork so we don't lose it when receiving '__same__' sentinel
  const cachedArtworkRef = useRef(null);
  const lastArtworkRef = useRef(null);

  // Process media updates — handle artwork caching
  const handleMediaUpdate = useCallback((state) => {
    if (!state) return;

    if (state.artwork === '__same__') {
      // Artwork unchanged — use cached version
      state.artwork = cachedArtworkRef.current;
    } else if (state.artwork && state.artwork.length > 10) {
      // New artwork — cache it
      cachedArtworkRef.current = state.artwork;
    } else if (!state.artwork || state.artwork.length < 10) {
      if (cachedArtworkRef.current) {
        state.artwork = cachedArtworkRef.current;
      }
    }

    setMediaState({ ...state });
  }, []);

  // ----------------------------------------------------------
  // Subscribe to real-time media updates from the main process
  // ----------------------------------------------------------
  useEffect(() => {
    // Get initial state
    window.electronAPI?.getMediaState().then((state) => {
      if (state) handleMediaUpdate(state);
    });

    // Listen for live updates
    const unsub = window.electronAPI?.onMediaUpdate((state) => {
      handleMediaUpdate(state);
    });

    return () => unsub?.();
  }, [handleMediaUpdate]);

  // ----------------------------------------------------------
  // Extract dominant color whenever artwork changes
  // ----------------------------------------------------------
  useEffect(() => {
    const artwork = mediaState?.artwork;
    if (!artwork || artwork === '__same__' || artwork === lastArtworkRef.current) return;
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
  // Subscribe to privacy state updates
  // ----------------------------------------------------------
  useEffect(() => {
    window.electronAPI?.getPrivacyState().then((state) => {
      if (state) setPrivacyState(state);
    });

    const unsub = window.electronAPI?.onPrivacyUpdate((state) => {
      setPrivacyState(state || { camera: [], microphone: [] });
    });

    return () => unsub?.();
  }, []);

  // ----------------------------------------------------------
  // Subscribe to display mode changes
  // ----------------------------------------------------------
  useEffect(() => {
    window.electronAPI?.getDisplayMode().then((mode) => {
      if (mode) setDisplayMode(mode);
    });

    const unsub = window.electronAPI?.onDisplayModeChanged((mode) => {
      setDisplayMode(mode);
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

  const handleSeek = useCallback((positionSeconds) => {
    window.electronAPI?.mediaSeek(positionSeconds);
  }, []);

  // ----------------------------------------------------------
  // Open the source app (click on album art)
  // ----------------------------------------------------------
  const handleOpenSource = useCallback(() => {
    if (mediaState?.source) {
      window.electronAPI?.openSourceApp(mediaState.source);
    }
  }, [mediaState?.source]);

  // Force a fresh media snapshot when the island expands.
  const handleExpandRefresh = useCallback(() => {
    window.electronAPI?.getMediaState().then((state) => {
      if (state) handleMediaUpdate(state);
    });
  }, [handleMediaUpdate]);

  // Toggle between music, calendar, and settings modes
  const toggleMode = useCallback(() => {
    setMode((prev) => {
      if (prev === 'music') return 'calendar';
      if (prev === 'calendar') return 'settings';
      return 'music';
    });
  }, []);

  const handleSetMode = useCallback((newMode) => {
    setMode(newMode);
  }, []);

  return (
    <DynamicIsland
      mode={mode}
      displayMode={displayMode}
      mediaState={mediaState}
      calendarEvents={calendarEvents}
      privacyState={privacyState}
      accentColor={accentColor}
      onPlayPause={handlePlayPause}
      onNext={handleNext}
      onPrevious={handlePrevious}
      onSeek={handleSeek}
      onOpenSource={handleOpenSource}
      onToggleMode={toggleMode}
      onSetMode={handleSetMode}
      onExpandRefresh={handleExpandRefresh}
    />
  );
}

export default App;
