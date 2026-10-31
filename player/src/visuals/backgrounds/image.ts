// Your image: a picture the listener uploads, filling the screen with a slow Ken Burns drift and zoom, dimmed so the visuals read
// over it, and breathing brighter with the bass. Until there is a picture it shows the plain ink.

import { Layer2D } from '../layer2d.ts';
import { alpha } from '../themes.ts';
import type { FrameData, LayerKind } from '../types.ts';
import { vignette } from './ink.ts';

/** Seconds for one slow zoom in and out */
const ZOOM_PERIOD = 46;

class ImageBackground extends Layer2D {
  private clock = 0;

  frame(f: FrameData): void {
    const { g, width, height } = this;
    const theme = f.theme;
    g.fillStyle = theme.ink;
    g.fillRect(0, 0, width, height);
    const image = f.image;
    const size = image ? imageSize(image) : null;
    if (image && size) {
      this.clock += f.dt * (0.25 + f.motion * 0.75);
      const t = this.clock;
      // Cover the screen, then zoom between 106% and 118% and drift a little
      const cover = Math.max(width / size.width, height / size.height);
      const zoom = 1.06 + 0.12 * (0.5 - 0.5 * Math.cos((t / ZOOM_PERIOD) * Math.PI * 2)) * Math.max(0.25, f.motion);
      const w = size.width * cover * zoom;
      const h = size.height * cover * zoom;
      const dx = Math.sin(t * 0.021) * (w - width) * 0.4;
      const dy = Math.cos(t * 0.017) * (h - height) * 0.4;
      g.drawImage(image, (width - w) / 2 + dx, (height - h) / 2 + dy, w, h);
      // Dim, less so on the bass
      g.fillStyle = alpha(theme.ink, Math.max(0.25, 0.6 - f.bass * 0.2 * Math.min(1.5, f.sensitivity) - f.pulse * 0.05 * f.motion));
      g.fillRect(0, 0, width, height);
    }
    vignette(g, width, height, theme.ink, 0.4);
  }
}

function imageSize(image: CanvasImageSource): { width: number; height: number } | null {
  if (image instanceof HTMLImageElement) return image.naturalWidth ? { width: image.naturalWidth, height: image.naturalHeight } : null;
  if (image instanceof HTMLCanvasElement || image instanceof ImageBitmap) return { width: image.width, height: image.height };
  return null;
}

export const image: LayerKind<'image'> = {
  id: 'image',
  name: 'Your image',
  description: 'A picture of your own, slowly drifting',
  resolution: 0.75,
  create: () => new ImageBackground(),
};
