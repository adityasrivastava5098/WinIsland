// ============================================================
// Color Extractor
// Extracts the dominant color from a base64-encoded image
// using a fast pixel-sampling approach. Used to color the
// sound wave bars and UI accents dynamically based on album art.
// ============================================================

/**
 * Extract dominant color from base64 image data.
 * Uses canvas-free sampling by decoding the image in a hidden <img>
 * and reading pixels via a temporary canvas.
 *
 * @param {string} base64Data - base64 encoded image (without data: prefix)
 * @returns {Promise<{r: number, g: number, b: number, hex: string}>}
 */
export function extractDominantColor(base64Data) {
  return new Promise((resolve) => {
    if (!base64Data) {
      resolve({ r: 255, g: 255, b: 255, hex: '#ffffff' });
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        // Sample at small size for performance
        const sampleSize = 16;
        canvas.width = sampleSize;
        canvas.height = sampleSize;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, sampleSize, sampleSize);

        const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
        const pixels = imageData.data;

        // Accumulate color values, ignoring very dark and very bright pixels
        let rSum = 0, gSum = 0, bSum = 0, count = 0;

        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];

          // Skip transparent pixels
          if (a < 128) continue;

          // Skip very dark pixels (near black)
          const brightness = (r + g + b) / 3;
          if (brightness < 30) continue;

          // Skip very bright pixels (near white)
          if (brightness > 240) continue;

          // Weight saturated colors more heavily
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const saturation = max === 0 ? 0 : (max - min) / max;
          const weight = 1 + saturation * 2;

          rSum += r * weight;
          gSum += g * weight;
          bSum += b * weight;
          count += weight;
        }

        if (count === 0) {
          resolve({ r: 255, g: 255, b: 255, hex: '#ffffff' });
          return;
        }

        const r = Math.round(rSum / count);
        const g = Math.round(gSum / count);
        const b = Math.round(bSum / count);

        // Boost saturation for more vivid accent color
        const boosted = boostSaturation(r, g, b, 1.4);

        // Ensure minimum brightness for visibility on dark background
        const final = ensureMinBrightness(boosted.r, boosted.g, boosted.b, 100);

        const hex = '#' +
          final.r.toString(16).padStart(2, '0') +
          final.g.toString(16).padStart(2, '0') +
          final.b.toString(16).padStart(2, '0');

        resolve({ ...final, hex });
      } catch {
        resolve({ r: 255, g: 255, b: 255, hex: '#ffffff' });
      }
    };

    img.onerror = () => {
      resolve({ r: 255, g: 255, b: 255, hex: '#ffffff' });
    };

    img.src = `data:image/jpeg;base64,${base64Data}`;
  });
}

// Boost saturation by a multiplier
function boostSaturation(r, g, b, factor) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  if (max === min) return { r, g, b }; // achromatic

  const mid = (max + min) / 2;
  return {
    r: Math.round(Math.min(255, Math.max(0, mid + (r - mid) * factor))),
    g: Math.round(Math.min(255, Math.max(0, mid + (g - mid) * factor))),
    b: Math.round(Math.min(255, Math.max(0, mid + (b - mid) * factor))),
  };
}

// Ensure minimum perceived brightness
function ensureMinBrightness(r, g, b, minBrightness) {
  const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
  if (brightness >= minBrightness) return { r, g, b };

  const scale = minBrightness / Math.max(brightness, 1);
  return {
    r: Math.round(Math.min(255, r * scale)),
    g: Math.round(Math.min(255, g * scale)),
    b: Math.round(Math.min(255, b * scale)),
  };
}
