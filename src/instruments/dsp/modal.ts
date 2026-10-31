// Modal synthesis: a sum of exponentially decaying partials. Bells, mallets, kalimba, music box.

import { Biquad, normalize, rng, tailFade } from './core.ts';

/** [frequency ratio, amplitude, decay seconds (T60)] */
export type ModalPartial = [number, number, number];

export interface ModalOpts {
  len: number;
  /** Attack time (seconds) */
  attack?: number;
  /** Strike noise: amplitude, decay seconds, band-pass center (as a multiple of the fundamental, or absolute Hz) */
  click?: { amp: number; t: number; hz: number; q?: number };
  /** Pitch bend down on the attack (ratio; returns to 1 within bendT seconds) */
  bend?: number;
  bendT?: number;
  /** Tremolo (amplitude modulation): rate in Hz, depth 0-1 */
  trem?: [number, number];
  /** Add a detuned copy of each partial (cents), to produce a bell's beating */
  beat?: number;
  /**
   * Mallet contact (Hz): a mallet stays on the bar for a moment (a millisecond or so for yarn and felt, far less for brass), and a force that
   * lasts τ has little energy above about 1/(2τ). Partials above this frequency are weakened 12 dB per octave, so the same mallet draws a rich
   * tone from a low bar and an almost pure one from a high bar.
   */
  mallet?: number;
  seed?: number;
}

export function modal(sr: number, f: number, parts: ModalPartial[], o: ModalOpts): Float32Array {
  const n = Math.floor(o.len * sr);
  const y = new Float32Array(n);
  const nyq = sr * 0.45;
  const att = Math.max(1, Math.floor((o.attack ?? 0.001) * sr));
  const r = rng(o.seed ?? Math.round(f * 13));
  for (const [ratio, a, t60] of parts) {
    const pf = f * ratio;
    if (pf >= nyq) continue;
    const amp = o.mallet ? a / (1 + (pf / o.mallet) ** 2) : a;
    const copies = o.beat ? [1, Math.pow(2, o.beat / 1200)] : [1];
    for (const cm of copies) {
      const w0 = (2 * Math.PI * pf * cm) / sr;
      const k = Math.pow(10, -3 / (t60 * sr));
      let env = amp / copies.length;
      let ph = r() * 0.3;
      for (let i = 0; i < n; i++) {
        let w = w0;
        if (o.bend && o.bendT) {
          const tt = i / sr;
          w = w0 * (1 + (o.bend - 1) * Math.exp(-tt / o.bendT));
        }
        ph += w;
        y[i] += Math.sin(ph) * env;
        env *= k;
        if (env < 1e-6) break;
      }
    }
  }
  for (let i = 0; i < att && i < n; i++) y[i] *= i / att;
  if (o.click) {
    const c = o.click;
    const hz = c.hz < 40 ? c.hz * f : c.hz;
    const bp = new Biquad(sr, 'bp', hz, c.q ?? 1.2);
    const k = Math.pow(10, -3 / (c.t * sr));
    let env = c.amp;
    for (let i = 0; i < n && env > 1e-5; i++) {
      y[i] += bp.run(r()) * env;
      env *= k;
    }
  }
  if (o.trem) {
    const [rate, depth] = o.trem;
    for (let i = 0; i < n; i++) y[i] *= 1 - depth * 0.5 * (1 - Math.cos((2 * Math.PI * rate * i) / sr));
  }
  return tailFade(normalize(y), sr);
}
