// Waveform: an oscilloscope line held steady on a rising zero crossing, with a soft glow and a graticule; layered, the last few
// traces linger like phosphor and a slower line traces the low end in brass.

import { Layer2D } from '../layer2d.ts';
import { alpha } from '../themes.ts';
import type { FrameData, LayerKind } from '../types.ts';

/** Samples shown across the screen (about 40 ms at 48 kHz) */
const WINDOW = 1920;
/** Traces kept for the phosphor echo */
const ECHOES = 4;

class Waveform extends Layer2D {
  private points = new Float32Array(0);
  private low = new Float32Array(0);
  private echoes: Float32Array[] = [];
  private echoIndex = 0;
  /** Running peak of the waveform, so quiet passages still fill the screen */
  private peak = 0.08;

  frame(f: FrameData): void {
    const { g, width, height } = this;
    g.clearRect(0, 0, width, height);
    const margin = Math.max(20, width * 0.07);
    const span = width - margin * 2;
    const count = Math.max(64, Math.min(f.quality === 'high' ? 360 : 240, Math.floor(span / 3)));
    if (this.points.length !== count) {
      this.points = new Float32Array(count);
      this.low = new Float32Array(count);
      this.echoes = Array.from({ length: ECHOES }, () => new Float32Array(count));
    }
    const cy = height * 0.5;
    const amp = height * (width < 700 ? 0.2 : 0.26);
    this.read(f);
    this.drawGraticule(f, margin, span, cy, amp);

    const theme = f.theme;
    if (f.layered) {
      // Phosphor: the last few traces, fading
      for (let e = 1; e <= ECHOES; e++) {
        const trace = this.echoes[(this.echoIndex - e + ECHOES) % ECHOES];
        g.lineWidth = 1;
        g.strokeStyle = alpha(theme.paper, 0.2 * (1 - e / (ECHOES + 1)));
        this.trace(trace, margin, span, cy, amp);
      }
      g.lineWidth = 1.25;
      g.strokeStyle = alpha(theme.accent, 0.75);
      this.trace(this.low, margin, span, cy, amp * 1.6);
    }
    // Glow, then the line itself
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.lineWidth = 7;
    g.strokeStyle = alpha(theme.accent, 0.06 + f.level * 0.05);
    this.trace(this.points, margin, span, cy, amp);
    g.lineWidth = 3;
    g.strokeStyle = alpha(theme.accent, 0.12 + f.level * 0.08);
    this.trace(this.points, margin, span, cy, amp);
    g.lineWidth = 1.5;
    g.strokeStyle = theme.paper;
    this.trace(this.points, margin, span, cy, amp);

    if (f.layered) {
      this.echoes[this.echoIndex].set(this.points);
      this.echoIndex = (this.echoIndex + 1) % ECHOES;
    }
  }

  /** Read a window of the waveform starting at a rising zero crossing, levelled and tapered at both ends */
  private read(f: FrameData): void {
    const w = f.waveform;
    const n = this.points.length;
    const window = Math.min(WINDOW, w.length >> 1);
    const start = trigger(w, w.length - window);
    let peak = 0;
    for (let i = 0; i < window; i++) peak = Math.max(peak, Math.abs(w[start + i]));
    this.peak = Math.max(0.03, peak, this.peak - f.dt * 0.05);
    const gain = (0.8 / this.peak) * Math.min(1.6, f.sensitivity);
    const bucket = window / n;
    const lowWidth = Math.max(8, Math.round(bucket * 6));
    for (let k = 0; k < n; k++) {
      const at = start + Math.floor(k * bucket);
      // Average a few samples, so the line is smooth and does not alias
      let sum = 0;
      const taps = Math.max(1, Math.round(bucket));
      for (let i = 0; i < taps; i++) sum += w[at + i];
      let low = 0;
      for (let i = 0; i < lowWidth; i++) low += w[Math.min(w.length - 1, at + i)];
      const x = k / (n - 1);
      const taper = Math.sin(Math.PI * x) ** 0.6;
      this.points[k] = Math.tanh((sum / taps) * gain) * taper;
      this.low[k] = Math.tanh((low / lowWidth) * gain) * taper;
    }
  }

  /** Stroke a trace as a smooth curve through its points */
  private trace(points: Float32Array, left: number, span: number, cy: number, amp: number): void {
    const { g } = this;
    const n = points.length;
    const dx = span / (n - 1);
    g.beginPath();
    g.moveTo(left, cy - points[0] * amp);
    for (let k = 1; k < n - 1; k++) {
      const x = left + k * dx;
      g.quadraticCurveTo(x, cy - points[k] * amp, x + dx / 2, cy - ((points[k] + points[k + 1]) / 2) * amp);
    }
    g.lineTo(left + span, cy - points[n - 1] * amp);
    g.stroke();
  }

  /** A measuring instrument's graticule: the centre line with ticks, and faint limits above and below */
  private drawGraticule(f: FrameData, left: number, span: number, cy: number, amp: number): void {
    const { g } = this;
    g.fillStyle = alpha(f.theme.muted, 0.28);
    g.fillRect(left, Math.round(cy), span, 1);
    g.fillStyle = alpha(f.theme.muted, 0.12);
    g.fillRect(left, Math.round(cy - amp), span, 1);
    g.fillRect(left, Math.round(cy + amp), span, 1);
    g.fillStyle = alpha(f.theme.muted, 0.35);
    const ticks = 20;
    for (let i = 0; i <= ticks; i++) {
      const x = Math.round(left + (i / ticks) * span);
      const major = i % 5 === 0;
      g.fillRect(x, Math.round(cy) - (major ? 5 : 3), 1, major ? 11 : 7);
    }
  }
}

/** The first rising zero crossing (on a lightly smoothed signal) at or before `limit`, so the trace stands still */
function trigger(w: Float32Array, limit: number): number {
  let previous = w[0];
  for (let i = 4; i < limit; i++) {
    const v = (w[i] + w[i - 1] + w[i - 2] + w[i - 3]) / 4;
    if (previous < 0 && v >= 0) return i;
    previous = v;
  }
  return 0;
}

export const waveform: LayerKind<'waveform'> = {
  id: 'waveform',
  name: 'Waveform',
  description: 'An oscilloscope trace with a soft glow',
  create: () => new Waveform(),
};
