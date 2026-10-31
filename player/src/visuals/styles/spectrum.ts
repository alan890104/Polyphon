// Spectrum: log-frequency bars on a hairline baseline, with brass peak marks that fall back slowly and a frequency scale below;
// mirrored, the bars grow both ways from a centre line.

import { Layer2D } from '../layer2d.ts';
import { alpha } from '../themes.ts';
import type { FrameData, LayerKind } from '../types.ts';
import { frequencyPlace, sampleBands } from './bands.ts';

/** The part of the spectrum shown (fractions of 32 Hz-16 kHz): about 40 Hz to 7 kHz, where synthesized music has its energy */
const FROM = 0.04;
const TO = 0.86;
const LABELS: [number, string][] = [
  [50, '50'],
  [100, '100'],
  [250, '250'],
  [500, '500'],
  [1000, '1k'],
  [2500, '2.5k'],
  [5000, '5k Hz'],
];
const MAX_BARS: Record<FrameData['quality'], number> = { high: 120, medium: 96, low: 64 };

class Spectrum extends Layer2D {
  private values = new Float32Array(0);
  private peaks = new Float32Array(0);
  private speed = new Float32Array(0);

  frame(f: FrameData): void {
    const { g, width, height } = this;
    g.clearRect(0, 0, width, height);
    const margin = Math.max(20, width * 0.08);
    const left = margin;
    const span = width - margin * 2;
    const count = Math.max(24, Math.min(MAX_BARS[f.quality], Math.floor(span / 10)));
    if (this.values.length !== count) {
      this.values = new Float32Array(count);
      this.peaks = new Float32Array(count);
      this.speed = new Float32Array(count);
    }
    sampleBands(f.bands, this.values, FROM, TO);

    const mirror = f.mirror;
    const base = mirror ? height * 0.5 : height * 0.7;
    const reach = mirror ? height * 0.3 : height * 0.46;
    const slot = span / count;
    const bar = Math.max(1, slot * 0.5);
    const theme = f.theme;

    // Bars, in one path with a gradient that fades towards the baseline
    const fade = g.createLinearGradient(0, base - reach, 0, mirror ? base + reach : base);
    fade.addColorStop(0, alpha(theme.paper, 0.95));
    fade.addColorStop(mirror ? 0.5 : 1, alpha(theme.paper, mirror ? 0.95 : 0.5));
    if (mirror) fade.addColorStop(1, alpha(theme.paper, 0.95));
    g.fillStyle = fade;
    g.beginPath();
    for (let k = 0; k < count; k++) {
      const h = this.values[k] * reach;
      this.updatePeak(k, h, f.dt, reach);
      if (h < 0.75) continue;
      const x = left + k * slot + (slot - bar) / 2;
      if (mirror) g.rect(x, base - h, bar, h * 2);
      else g.rect(x, base - h, bar, h);
    }
    g.fill();

    // A faint reflection under the baseline
    if (!mirror) {
      g.fillStyle = alpha(theme.paper, 0.07);
      g.beginPath();
      for (let k = 0; k < count; k++) {
        const h = this.values[k] * reach * 0.22;
        if (h > 0.5) g.rect(left + k * slot + (slot - bar) / 2, base + 3, bar, h);
      }
      g.fill();
    }

    // Peak marks, once they lift off their bar
    g.fillStyle = theme.accent;
    g.beginPath();
    for (let k = 0; k < count; k++) {
      const p = this.peaks[k];
      if (p < 3 || p - this.values[k] * reach < 4) continue;
      const x = left + k * slot + (slot - bar) / 2;
      g.rect(x, base - p - 4, bar, 1.5);
      if (mirror) g.rect(x, base + p + 2.5, bar, 1.5);
    }
    g.fill();

    this.drawScale(f, left, span, mirror ? base + reach + 28 : base + reach * 0.22 + 24, base);
  }

  /** The peak is pushed up by its bar and falls with gravity */
  private updatePeak(k: number, h: number, dt: number, reach: number): void {
    if (h >= this.peaks[k]) {
      this.peaks[k] = h;
      this.speed[k] = 0;
      return;
    }
    this.speed[k] += dt * reach * 1.4;
    this.peaks[k] = Math.max(h, this.peaks[k] - this.speed[k] * dt);
  }

  /** The baseline, and a frequency scale in small mono figures */
  private drawScale(f: FrameData, left: number, span: number, labelsAt: number, base: number): void {
    const { g } = this;
    const theme = f.theme;
    g.fillStyle = alpha(theme.muted, 0.5);
    g.fillRect(left, Math.round(base) + (f.mirror ? 0 : 1), span, 1);
    if (this.width < 520) return;
    g.font = '500 10px "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    for (const [hz, text] of LABELS) {
      const t = frequencyPlace(hz, FROM, TO);
      if (t < 0 || t > 1) continue;
      const x = left + t * span;
      g.fillStyle = alpha(theme.muted, 0.45);
      g.fillRect(Math.round(x), labelsAt - 16, 1, 5);
      g.fillStyle = alpha(theme.muted, 0.8);
      g.fillText(text, x, labelsAt);
    }
  }
}

export const spectrum: LayerKind<'spectrum'> = {
  id: 'spectrum',
  name: 'Spectrum',
  description: 'Bars across the frequencies, with falling peak marks',
  create: () => new Spectrum(),
};
