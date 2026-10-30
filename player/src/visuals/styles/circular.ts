// Circular spectrum: hairline bars radiating around the song's disc, which turns clockwise under a brass comb at 12 o'clock as the
// song plays; each perforation lights in brass as it passes the comb and fades as it moves on, and the disc swells slightly on beats.

import { DISC, DiscGeometry, renderDisc } from '../disc.ts';
import { Layer2D } from '../layer2d.ts';
import { alpha, type Theme } from '../themes.ts';
import type { NoteTimeline } from '../timeline.ts';
import type { FrameData, LayerKind } from '../types.ts';
import { sampleBands, soften } from './bands.ts';

/** Bars on each side (the two halves mirror each other) */
const BARS: Record<FrameData['quality'], number> = { high: 96, medium: 80, low: 60 };
/** Seconds a perforation stays lit after it passes the comb */
const AFTERGLOW = 2.5;

class CircularSpectrum extends Layer2D {
  private disc: HTMLCanvasElement | null = null;
  private discKey = '';
  private discFor: NoteTimeline | null = null;
  private geometry = new DiscGeometry(null);
  private values = new Float32Array(0);
  private radius = 0;

  protected layout(): void {
    this.radius = Math.min(this.width, this.height) * (this.width < 700 ? 0.3 : 0.21);
    this.discKey = '';
  }

  frame(f: FrameData): void {
    const { g, width, height } = this;
    g.clearRect(0, 0, width, height);
    this.prepareDisc(f.timeline, f.theme);
    const count = BARS[f.quality];
    if (this.values.length !== count) this.values = new Float32Array(count);
    sampleBands(f.bands, this.values, 0.04, 0.9);
    soften(this.values);

    const cx = width / 2;
    const cy = height / 2;
    const swell = 1 + f.pulse * 0.025 * f.motion + f.bass * 0.015 * f.motion;
    const r = this.radius * swell;

    this.drawGlow(f, cx, cy, r);
    this.drawBars(f, cx, cy, r);
    g.save();
    g.translate(cx, cy);
    g.rotate(this.geometry.turn(f.position));
    if (this.disc) g.drawImage(this.disc, -r, -r, r * 2, r * 2);
    this.drawLit(f, r);
    g.restore();
    this.drawComb(f, cx, cy, r);
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
  private drawLit(f: FrameData, r: number): void {
    const { g, geometry } = this;
    if (!f.timeline) return;
    g.lineCap = 'round';
    g.strokeStyle = f.theme.lit;
    f.timeline.forEach(f.position - AFTERGLOW, f.position, (n, offset) => {
      const age = f.position - (n.start + offset);
      if (age < 0 || age > AFTERGLOW) return;
      const fade = (1 - age / AFTERGLOW) ** 1.5;
      // A soft halo, then the hole itself
      g.globalAlpha = fade * 0.25;
      g.lineWidth = geometry.holeWidth(r, 2.6);
      g.beginPath();
      geometry.hole(g, n, r, offset, 2.6);
      g.stroke();
      g.globalAlpha = fade;
      g.lineWidth = geometry.holeWidth(r, 1.3);
      g.beginPath();
      geometry.hole(g, n, r, offset, 1.3);
      g.stroke();
    });
    g.globalAlpha = 1;
  }

  /** The comb at 12 o'clock: a brass hairline across the rows, and a small pointer outside the rim */
  private drawComb(f: FrameData, cx: number, cy: number, r: number): void {
    const { g } = this;
    const theme: Theme = f.theme;
    g.lineCap = 'butt';
    g.strokeStyle = alpha(theme.accent, 0.55 + f.level * 0.4);
    g.lineWidth = Math.max(1, r / 120);
    g.beginPath();
    g.moveTo(cx, cy - r * DISC.rim);
    g.lineTo(cx, cy - r * (DISC.hits - 0.04));
    g.stroke();
    const half = r * 0.03;
    const tip = cy - r - 3;
    g.fillStyle = theme.accent;
    g.beginPath();
    g.moveTo(cx - half, tip - half * 1.6);
    g.lineTo(cx + half, tip - half * 1.6);
    g.lineTo(cx, tip);
    g.closePath();
    g.fill();
  }

  /** Draw the disc again when the song, the theme or the size changes */
  private prepareDisc(timeline: NoteTimeline | null, theme: Theme): void {
    const size = Math.round(this.radius * 2 * this.scale * 1.05);
    const key = `${theme.id}|${size}`;
    if (this.disc && key === this.discKey && this.discFor === timeline) return;
    this.discFor = timeline;
    this.discKey = key;
    this.geometry = new DiscGeometry(timeline);
    this.disc = renderDisc(timeline, theme, size);
  }
}

export const circular: LayerKind<'circular'> = {
  id: 'circular',
  name: 'Circular',
  description: 'The song’s disc turning under the comb, ringed by its spectrum',
  create: () => new CircularSpectrum(),
};
