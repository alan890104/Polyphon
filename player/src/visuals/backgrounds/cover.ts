// Cover disc: the song's disc, enlarged far past the screen, blurred and dimmed, turning once over the song; it brightens with
// the bass.

import { DiscGeometry, renderDisc } from '../disc.ts';
import { Layer2D } from '../layer2d.ts';
import type { Theme } from '../themes.ts';
import type { NoteTimeline } from '../timeline.ts';
import type { FrameData, LayerKind } from '../types.ts';
import { vignette } from './ink.ts';

/** The disc is drawn this many pixels across, then blurred: it is shown enlarged, so detail would be lost anyway */
const SIZE = 640;

class CoverDisc extends Layer2D {
  private disc: HTMLCanvasElement | null = null;
  private discFor: NoteTimeline | null | undefined;
  private discTheme: Theme | null = null;
  private geometry = new DiscGeometry(null);

  frame(f: FrameData): void {
    const { g, width, height } = this;
    const theme = f.theme;
    if (this.discFor !== f.timeline || this.discTheme !== theme) {
      this.discFor = f.timeline;
      this.discTheme = theme;
      this.disc = blurred(renderDisc(f.timeline, theme, SIZE));
      this.geometry = new DiscGeometry(f.timeline);
    }
    g.fillStyle = theme.ink;
    g.fillRect(0, 0, width, height);
    if (this.disc) {
      const d = Math.max(width, height) * 1.25 * (1 + f.bass * 0.015 * f.motion);
      g.save();
      g.translate(width / 2, height * 0.5);
      g.rotate(this.geometry.turn(f.position) + f.time * 0.004 * f.motion);
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
