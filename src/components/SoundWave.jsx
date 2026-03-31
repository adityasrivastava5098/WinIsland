// ============================================================
// Sound Wave Animation
// Animated equalizer bars that pulse when music is playing.
// Pure CSS-driven animation for minimal performance overhead.
// ============================================================

import React from 'react';

function SoundWave() {
  return (
    <div className="sound-wave" aria-hidden="true">
      <span className="sound-bar" style={{ animationDelay: '0s' }} />
      <span className="sound-bar" style={{ animationDelay: '0.15s' }} />
      <span className="sound-bar" style={{ animationDelay: '0.3s' }} />
      <span className="sound-bar" style={{ animationDelay: '0.1s' }} />
    </div>
  );
}

export default SoundWave;
