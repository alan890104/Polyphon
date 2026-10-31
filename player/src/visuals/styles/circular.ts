// Circular spectrum: hairline bars radiating around the song's disc, which turns clockwise under a brass comb at 12 o'clock as the
// song plays; each perforation lights in brass as it passes the comb and fades as it moves on, and the disc swells slightly on beats.

import { discCanvas, drawComb, drawHole, EMPTY_DISC, forEachLit, geometry, holesAt, songDisc, turnAt, type Disc, type Geometry } from '../../disc.ts';
import { Layer2D } from '../layer2d.ts';
import { alpha, discPalette, type Theme } from '../themes.ts';
import type { FrameData, LayerKind } from '../types.ts';
import { sampleBands, soften } from './bands.ts';

/** Bars on each side (the two halves mirror each other) */
const BARS: Record<FrameData['quality'], number> = { high: 96, medium: 80, low: 60 };
/** Seconds a perforation stays lit after it passes the comb */
const AFTERGLOW = 2.5;

class CircularSpectrum extends Layer2D {
  private disc: HTMLCanvasElement | null = null;
  private discKey = '';
  private discFor: Disc | null = null;
  private values = new Float32Array(0);
  private radius = 0;

  protected layout(): void {
    this.radius = Math.min(this.width, this.height) * (this.width < 700 ? 0.3 : 0.21);
    this.discKey = '';
  }

  frame(f: FrameData): void {
    const { g, width, height } = this;
    g.clearRect(0, 0, width, height);
    const disc = f.timeline ? songDisc(f.timeline.song) : EMPTY_DISC;
    this.prepareDisc(disc, f.theme);
    const count = BARS[f.quality];
    if (this.values.length !== count) this.values = new Float32Array(count);
    sampleBands(f.bands, this.values, 0.04, 0.9);
    soften(this.values);

    const cx = width / 2;
    const cy = height / 2;
    const swell = 1 + f.pulse * 0.025 * f.motion + f.bass * 0.015 * f.motion;
    const r = this.radius * swell;
    const geo = geometry(r * 2, 'full');
    const turn = turnAt(f.position, f.duration);

    this.drawGlow(f, cx, cy, r);
    this.drawBars(f, cx, cy, r);
    g.save();
    g.translate(cx, cy);
    g.rotate(turn * Math.PI * 2);
    g.translate(-r, -r);
    if (this.disc) g.drawImage(this.disc, 0, 0, r * 2, r * 2);
    this.drawLit(f, disc, geo, turn);
    g.restore();
    g.save();
    g.translate(cx - r, cy - r);
    drawComb(g, geo, f.theme.accent, 0.55 + f.level * 0.4, 1);
    g.restore();
  }

  /** A faint warm light behind the disc that opens with the bass */
  private drawGlow(f: FrameData, cx: number, cy: number, r: number): void {
    const { g } = this;
    const strength = 0.03 + f.bass * 0.06 + f.pulse * 0.04 * f.motion;
    const halo = g.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 2.4);
    halo.addColorStop(0, alpha(f.theme.accent, strength));
    halo.addColorStop(1, alpha(f.theme.accent, 0));
    g.fillStyle = halo;
    g.fillRect(cx - r * 2.4, cy - r * 2.4, r * 4.8, r * 4.8);
  }

  /** Bass at the bottom, treble towards the top, mirrored left and right */
  private drawBars(f: FrameData, cx: number, cy: number, r: number): void {
    const { g } = this;
    const count = this.values.length;
    const base = r * 1.08;
    const reach = r * (this.width < 700 ? 0.55 : 0.8);
    const step = Math.PI / (count + 1);
    g.lineCap = 'round';
    g.lineWidth = Math.max(1.25, ((Math.PI * 2 * base) / (count * 2)) * 0.34);
    g.strokeStyle = alpha(f.theme.paper, 0.82);
    g.beginPath();
    for (let i = 0; i < count; i++) {
      const length = 1.5 + this.values[i] * reach;
      const a = Math.PI - (i + 1) * step;
      const s = Math.sin(a);
      const c = -Math.cos(a);
      g.moveTo(cx + s * base, cy - c * base);
      g.lineTo(cx + s * (base + length), cy - c * (base + length));
      g.moveTo(cx - s * base, cy - c * base);
      g.lineTo(cx - s * (base + length), cy - c * (base + length));
    }
    g.stroke();
  }

  /** Perforations that passed the comb a moment ago: brass, fading as they move on */
  private drawLit(f: FrameData, disc: Disc, geo: Geometry, turn: number): void {
    const { g } = this;
    forEachLit(holesAt(disc, 'full'), turn, AFTERGLOW / f.duration, (hole, glow) => {
      const fade = glow ** 1.5;
      // A soft halo, then the hole itself
      drawHole(g, hole, geo, f.theme.lit, fade * 0.25, 2.6);
      drawHole(g, hole, geo, f.theme.lit, fade, 1.3);
    });
  }

  /** Draw the disc again when the song, the theme or the size changes */
  private prepareDisc(disc: Disc, theme: Theme): void {
    const size = Math.round(this.radius * 2 * this.scale * 1.05);
    const key = `${theme.id}|${size}`;
    if (this.disc && key === this.discKey && this.discFor === disc) return;
    this.discFor = disc;
    this.discKey = key;
    this.disc = discCanvas(disc, 'full', size, discPalette(theme));
  }
}

export const circular: LayerKind<'circular'> = {
  id: 'circular',
  name: 'Circular',
  description: 'The song’s disc turning under the comb, ringed by its spectrum',
  create: () => new CircularSpectrum(),
};
