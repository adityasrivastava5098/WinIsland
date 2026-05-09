const { clipboard } = require('electron');

const POLL_INTERVAL = 500; // Poll every 500ms for clipboard changes

class ClipboardManager {
  constructor() {
    this.lastText = '';
    this.lastFormats = [];
    this.pollTimer = null;
    this.callback = null;
  }

  startPolling(callback) {
    this.callback = callback;
    
    // Initialize with current content to avoid triggering on app start
    this.lastFormats = clipboard.availableFormats();
    if (this.lastFormats.includes('text/plain')) {
      this.lastText = clipboard.readText();
    }

    const poll = () => {
      const currentFormats = clipboard.availableFormats();
      let changed = false;

      // 1. Check if formats changed
      if (currentFormats.length !== this.lastFormats.length || 
          !currentFormats.every((val, index) => val === this.lastFormats[index])) {
        changed = true;
      } 
      // 2. If formats are same, check content of common formats
      else if (currentFormats.includes('text/plain')) {
        const currentText = clipboard.readText();
        if (currentText !== this.lastText) {
          changed = true;
          this.lastText = currentText;
        }
      }
      // 3. For images, we check if it has image but we didn't before, or vice versa
      // (Deep comparison of images is expensive, so formats change is our best bet for image-to-image)

      if (changed) {
        this.lastFormats = currentFormats;
        if (currentFormats.includes('text/plain')) {
          this.lastText = clipboard.readText();
        }
        
        if (this.callback) {
          this.callback({
            formats: currentFormats,
            timestamp: Date.now()
          });
        }
      }
    };

    this.pollTimer = setInterval(poll, POLL_INTERVAL);
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}

module.exports = ClipboardManager;
