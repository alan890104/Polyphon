// Starfield: fine stars drifting slowly towards the viewer, faster as the music grows louder, twinkling with the treble.

import { Layer2D } from '../layer2d.ts';
import { alpha } from '../themes.ts';
import type { FrameData, LayerKind } from '../types.ts';
import { vignette } from './ink.ts';

const COUNT: Record<FrameData['quality'], number> = { high: 900, medium: 650, low: 380 };
/** Every so many stars is brass */
const ACCENT_EVERY = 23;

class Starfield extends Layer2D {
  private x = new Float32Array(0);
  private y = new Float32Array(0);
  private z = new Float32Array(0);
  private quality: FrameData['quality'] | null = null;

  frame(f: FrameData): void {
    const { g, width, height } = this;
    if (this.quality !== f.quality) this.seed(COUNT[f.quality], f.quality);
    const theme = f.theme;
    g.fillStyle = theme.ink;
    g.fillRect(0, 0, width, height);

    const speed = (0.012 + f.level * 0.05 * f.motion + f.pulse * 0.03 * f.motion) * (0.3 + f.motion);
    const cx = width / 2;
    const cy = height / 2;
    const focal = Math.max(width, height) * 0.5;
    const n = this.z.length;
    for (let i = 0; i < n; i++) {
      this.z[i] -= f.dt * speed;
      if (this.z[i] <= 0.05) this.respawn(i, 1);
    }
    // Three brightness steps by distance, each in one fill
    for (let step = 0; step < 3; step++) {
      const far = step === 0;
      const twinkle = far ? 0.7 + f.treble * 0.5 : 1;
      for (const accent of [false, true]) {
        g.fillStyle = alpha(accent ? theme.accent : theme.paper, (0.25 + step * 0.3) * twinkle);
        g.beginPath();
        for (let i = 0; i < n; i++) {
          const z = this.z[i];
          if (Math.min(2, Math.floor((1 - z) * 3)) !== step || (i % ACCENT_EVERY === 0) !== accent) continue;
          const sx = cx + (this.x[i] / z) * focal;
          const sy = cy + (this.y[i] / z) * focal;
          if (sx < -2 || sy < -2 || sx > width + 2 || sy > height + 2) {
            this.respawn(i, 0.6 + Math.random() * 0.4);
            continue;
          }
          const size = 0.6 + (1 - z) * 1.6;
          g.rect(sx - size / 2, sy - size / 2, size, size);
        }
        g.fill();
      }
    }
    vignette(g, width, height, theme.ink, 0.55);
  }

  private seed(count: number, quality: FrameData['quality']): void {
    this.quality = quality;
    this.x = new Float32Array(count);
    this.y = new Float32Array(count);
    this.z = new Float32Array(count);
    for (let i = 0; i < count; i++) this.respawn(i, 0.05 + Math.random() * 0.95);
  }

  private respawn(i: number, z: number): void {
    const aspect = this.width / Math.max(1, this.height);
    this.x[i] = (Math.random() - 0.5) * 1.1 * Math.max(1, aspect);
    this.y[i] = (Math.random() - 0.5) * 1.1 / Math.min(1, aspect);
    this.z[i] = z;
  }
}

export const starfield: LayerKind<'starfield'> = {
  id: 'starfield',
  name: 'Starfield',
  description: 'Fine stars drifting closer as the music grows',
  create: () => new Starfield(),
};
