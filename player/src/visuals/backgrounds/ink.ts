// Ink: the plain ground of the house palette, with a warm light low in the middle that rises with the bass, and a vignette that
// opens a little as the music swells.

import { Layer2D } from '../layer2d.ts';
import { alpha } from '../themes.ts';
import type { FrameData, LayerKind } from '../types.ts';

class Ink extends Layer2D {
  frame(f: FrameData): void {
    const { g, width, height } = this;
    const theme = f.theme;
    g.fillStyle = theme.ink;
    g.fillRect(0, 0, width, height);
    const r = Math.max(width, height);
    const light = g.createRadialGradient(width / 2, height * 0.56, 0, width / 2, height * 0.56, r * 0.62);
    light.addColorStop(0, alpha(theme.accent, 0.035 + f.bass * 0.05 + f.pulse * 0.02 * f.motion));
    light.addColorStop(1, alpha(theme.accent, 0));
    g.fillStyle = light;
    g.fillRect(0, 0, width, height);
    vignette(g, width, height, theme.ink, 0.5 + f.level * 0.08);
  }
}

/** Darken the edges: clear from `open` (a fraction of the half-diagonal) outwards */
export function vignette(g: CanvasRenderingContext2D, width: number, height: number, ink: string, open: number): void {
  const r = Math.hypot(width, height) / 2;
  const shade = g.createRadialGradient(width / 2, height / 2, r * open, width / 2, height / 2, r);
  shade.addColorStop(0, alpha(ink, 0));
  shade.addColorStop(1, alpha(ink, 0.85));
  g.fillStyle = shade;
  g.fillRect(0, 0, width, height);
}

export const ink: LayerKind<'ink'> = {
  id: 'ink',
  name: 'Ink',
  description: 'The plain dark ground, warmed by the bass',
  resolution: 0.5,
  create: () => new Ink(),
};
