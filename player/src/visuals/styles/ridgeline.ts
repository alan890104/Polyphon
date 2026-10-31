// Ridgeline: the spectrum's recent history as stacked hairline ridges, newest in front, each hiding the ones behind it, like a
// printed plot of pulses. The stack scrolls back smoothly as new ridges arrive.

import { Layer2D } from '../layer2d.ts';
import { alpha } from '../themes.ts';
import type { FrameData, LayerKind } from '../types.ts';
import { sampleBands, soften } from './bands.ts';

const RIDGES: Record<FrameData['quality'], number> = { high: 46, medium: 38, low: 28 };
/** Points along each ridge */
const POINTS = 72;
/** Seconds between ridges */
const EVERY = 0.075;

class Ridgeline extends Layer2D {
  private ridges: Float32Array[] = [];
  /** Index of the newest ridge */
  private head = 0;
  private clock = 0;
  private readonly sample = new Float32Array(POINTS);
  /** A fixed bell across each ridge: flat at the sides, free in the middle */
  private readonly bell = Float32Array.from({ length: POINTS }, (_, k) => {
    const x = k / (POINTS - 1);
    return Math.exp(-(((x - 0.5) / 0.22) ** 2)) * 0.92 + 0.08;
  });
  /** Small fixed wobble per point, so silence is not a ruled line */
  private readonly grain = Float32Array.from({ length: POINTS }, () => Math.random());

  frame(f: FrameData): void {
    const { g, width, height } = this;
    g.clearRect(0, 0, width, height);
    const count = RIDGES[f.quality];
    if (this.ridges.length !== count) {
      this.ridges = Array.from({ length: count }, () => new Float32Array(POINTS));
      this.head = 0;
    }
    this.clock += f.dt;
    if (this.clock >= EVERY) {
      this.clock %= EVERY;
      this.capture(f);
    }

    const narrow = width < 700;
    const plotWidth = Math.min(width * (narrow ? 0.86 : 0.42), 620);
    const plotHeight = Math.min(height * 0.62, plotWidth * 1.25);
    const left = (width - plotWidth) / 2;
    const top = (height - plotHeight) / 2 + plotHeight * 0.08;
    const spacing = plotHeight / count;
    const lift = spacing * (narrow ? 6 : 8);
    const scroll = (this.clock / EVERY) * spacing;
    const dx = plotWidth / (POINTS - 1);
    const theme = f.theme;
    this.drawPlate(f, left, top, plotWidth, plotHeight);

    // Back to front: the oldest ridge at the top
    for (let r = count - 1; r >= 0; r--) {
      const ridge = this.ridges[(this.head - r + count) % count];
      const base = top + (count - 1 - r) * spacing - scroll + spacing;
      const age = r / count;
      g.beginPath();
      g.moveTo(left, base - ridge[0] * lift);
      for (let k = 1; k < POINTS - 1; k++) {
        const x = left + k * dx;
        g.quadraticCurveTo(x, base - ridge[k] * lift, x + dx / 2, base - ((ridge[k] + ridge[k + 1]) / 2) * lift);
      }
      g.lineTo(left + plotWidth, base - ridge[POINTS - 1] * lift);
      g.fillStyle = theme.ink;
      g.fill();
      g.lineWidth = r === 0 ? 1.4 : 1;
      g.strokeStyle = r === 0 ? alpha(theme.accent, 0.95) : alpha(theme.paper, 0.85 * (1 - age * 0.75));
      g.stroke();
    }
  }

  /** The plot is printed on a plate of ink with a hairline edge, so over a picture or the aurora it reads as a card */
  private drawPlate(f: FrameData, left: number, top: number, width: number, height: number): void {
    const { g } = this;
    const pad = Math.max(24, width * 0.07);
    const x = left - pad;
    const y = top - pad - height * 0.1;
    const w = width + pad * 2;
    const h = height * 1.1 + pad * 2.2;
    g.fillStyle = alpha(f.theme.ink, 0.94);
    g.fillRect(x, y, w, h);
    g.strokeStyle = alpha(f.theme.muted, 0.22);
    g.lineWidth = 1;
    g.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h));
  }

  /** Take the current spectrum as the newest ridge */
  private capture(f: FrameData): void {
    sampleBands(f.bands, this.sample, 0.04, 0.9);
    soften(this.sample);
    soften(this.sample);
    this.head = (this.head + 1) % this.ridges.length;
    const ridge = this.ridges[this.head];
    for (let k = 0; k < POINTS; k++) {
      // Low notes in the middle, spreading outwards: fold the spectrum around the centre
      const x = Math.abs(k - (POINTS - 1) / 2) / ((POINTS - 1) / 2);
      const v = this.sampleAt(x);
      ridge[k] = (v * 0.9 + this.grain[k] * 0.025 * (0.3 + f.level)) * this.bell[k];
    }
  }

  private sampleAt(x: number): number {
    const at = x * (POINTS - 1);
    const i = Math.floor(at);
    const t = at - i;
    return this.sample[i] + ((this.sample[Math.min(POINTS - 1, i + 1)] ?? 0) - this.sample[i]) * t;
  }
}

export const ridgeline: LayerKind<'ridgeline'> = {
  id: 'ridgeline',
  name: 'Ridgeline',
  description: 'The spectrum’s recent history, stacked like a printed plot',
  create: () => new Ridgeline(),
};
