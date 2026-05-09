const loudness = require('loudness');

class VolumeManager {
  constructor() {
    this.ready = true;
    this.onVolumeChangeCallback = null;
    this.lastVol = -1;
    this.pollInterval = null;
    
    this._init();
  }

  _init() {
    // Initial fetch
    this.getVolume((vol) => {
      this.lastVol = vol;
    });

    // Fallback polling for external volume changes (e.g. keyboard keys)
    this.pollInterval = setInterval(async () => {
      try {
        const isMuted = await loudness.getMuted();
        const vol = await loudness.getVolume();
        const effectiveVol = isMuted ? 0 : vol;

        if (effectiveVol !== this.lastVol && effectiveVol !== -1) {
          this.lastVol = effectiveVol;
          if (this.onVolumeChangeCallback) {
            this.onVolumeChangeCallback(effectiveVol);
          }
        }
      } catch (e) {
        // Ignore temporary read errors
      }
    }, 500);
  }

  async getVolume(callback) {
    try {
      const isMuted = await loudness.getMuted();
      const vol = await loudness.getVolume();
      const effectiveVol = isMuted ? 0 : vol;
      this.lastVol = effectiveVol;
      callback(effectiveVol);
    } catch (e) {
      callback(-1);
    }
  }

  async setVolume(level) {
    const clamped = Math.max(0, Math.min(100, Math.round(level)));
    try {
      if (clamped === 0) {
        await loudness.setMuted(true);
        await loudness.setVolume(0);
      } else {
        await loudness.setMuted(false);
        await loudness.setVolume(clamped);
      }
      this.lastVol = clamped;
    } catch (e) {
      console.error('[VolumeManager] Set error:', e);
    }
  }

  onVolumeChange(callback) {
    this.onVolumeChangeCallback = callback;
  }

  dispose() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}

module.exports = VolumeManager;
