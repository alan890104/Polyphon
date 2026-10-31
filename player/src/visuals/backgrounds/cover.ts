// Cover disc: the song's disc, enlarged far past the screen, blurred and dimmed, turning once over the song; it brightens with
// the bass.

import { discCanvas, EMPTY_DISC, songDisc, turnAt, type Disc } from '../../disc.ts';
import { Layer2D } from '../layer2d.ts';
import { discPalette, type Theme } from '../themes.ts';
import type { FrameData, LayerKind } from '../types.ts';
import { vignette } from './ink.ts';

/** The disc is drawn this many pixels across, then blurred: it is shown enlarged, so detail would be lost anyway */
const SIZE = 640;

class CoverDisc extends Layer2D {
  private disc: HTMLCanvasElement | null = null;
  private discFor: Disc | null = null;
  private discTheme: Theme | null = null;

  frame(f: FrameData): void {
    const { g, width, height } = this;
    const theme = f.theme;
    const disc = f.timeline ? songDisc(f.timeline.song) : EMPTY_DISC;
    if (this.discFor !== disc || this.discTheme !== theme) {
      this.discFor = disc;
      this.discTheme = theme;
      this.disc = blurred(discCanvas(disc, 'full', SIZE, discPalette(theme)));
    }
    g.fillStyle = theme.ink;
    g.fillRect(0, 0, width, height);
    if (this.disc) {
      const d = Math.max(width, height) * 1.25 * (1 + f.bass * 0.015 * f.motion);
      g.save();
      g.translate(width / 2, height * 0.5);
      g.rotate(turnAt(f.position, f.duration) * Math.PI * 2 + f.time * 0.004 * f.motion);
      g.globalAlpha = 0.3 + f.bass * 0.2;
      g.drawImage(this.disc, -d / 2, -d / 2, d, d);
      g.restore();
      g.globalAlpha = 1;
    }
    vignette(g, width, height, theme.ink, 0.3);
  }
}

/** A soft copy of a canvas: a blur filter where there is one, otherwise drawn small and scaled back up */
function blurred(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = out.height = source.width;
  const g = out.getContext('2d');
  if (!g) return source;
  if ('filter' in g) {
    g.filter = `blur(${Math.round(source.width / 240)}px)`;
    if (g.filter !== 'none') {
      g.drawImage(source, 0, 0);
      return out;
    }
  }
  const small = document.createElement('canvas');
  small.width = small.height = Math.round(source.width / 3);
  small.getContext('2d')?.drawImage(source, 0, 0, small.width, small.height);
  g.imageSmoothingQuality = 'high';
  g.drawImage(small, 0, 0, out.width, out.height);
  return out;
}

export const cover: LayerKind<'cover'> = {
  id: 'cover',
  name: 'Cover disc',
  description: 'The song’s disc, enlarged, blurred and slowly turning',
  resolution: 0.5,
  create: () => new CoverDisc(),
};
