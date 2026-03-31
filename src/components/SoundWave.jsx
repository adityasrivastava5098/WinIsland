// ============================================================
// Sound Wave Animation (Redesigned)
// iPhone-style animated equalizer bars.
// Accepts a dynamic color (extracted from album art).
// Two sizes: 'small' for inline, 'large' for collapsed pill.
// ============================================================

import React from 'react';

function SoundWave({ color = '#ffffff', size = 'small' }) {
  const isLarge = size === 'large';
  const barCount = isLarge ? 5 : 4;
  const barWidth = isLarge ? 3.5 : 2.5;
  const height = isLarge ? 20 : 14;
  const gap = isLarge ? 2.5 : 2;

  // Staggered delays for organic feel
  const delays = [0, 0.12, 0.24, 0.08, 0.18];
  // Different animation durations per bar for variety
  const durations = [0.45, 0.55, 0.4, 0.5, 0.42];

  return (
    <div
      className="sound-wave"
      style={{ height: `${height}px`, gap: `${gap}px` }}
      aria-hidden="true"
    >
      {Array.from({ length: barCount }).map((_, i) => (
        <span
          key={i}
          className="sound-bar"
          style={{
            width: `${barWidth}px`,
            backgroundColor: color,
            animationDelay: `${delays[i]}s`,
            animationDuration: `${durations[i]}s`,
          }}
        />
      ))}
    </div>
  );
}

export default SoundWave;
