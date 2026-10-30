// Plucked strings: Karplus-Strong for guitars, harps and dulcimers; an additive model for bass plucks.

import { Biquad, normalize, rng, tailFade } from './core.ts';

// ───────────────────────── Plucked string: Karplus-Strong ─────────────────────────

export interface KsOpts {
  /** Length in seconds */
  len: number;
  /** Seconds to decay to -60 dB (at this pitch) */
  t60: number;
  /** Pluck brightness 0-1 (low-pass on the excitation) */
  bright: number;
  /** Pluck position 0-0.5 (comb filter, the smaller the sharper) */
  pos: number;
  /** Weight of the loop filter (0.5 is darkest, the smaller the brighter) */
  s?: number;
  /** Detune of the second string (cents); 0 means a single string */
  detune?: number;
  seed?: number;
}

function ksString(sr: number, f: number, o: KsOpts, seed: number): Float32Array {
  const n = Math.floor(o.len * sr);
  const y = new Float32Array(n);
  const s = o.s ?? 0.5;
  const P = sr / f;
  const L = Math.max(2, Math.floor(P - s - 0.2));
  const frac = P - s - L;
  const C = (1 - frac) / (1 + frac);
  const g = Math.pow(10, -3 / (o.t60 * f));
  // Excitation: low-pass-filtered noise with a delayed copy subtracted (the pluck position)
  const r = rng(seed);
  const exc = new Float32Array(L + 1);
  let lp = 0;
  const a = 0.05 + 0.95 * o.bright;
  for (let i = 0; i <= L; i++) {
    lp += a * (r() - lp);
    exc[i] = lp;
  }
  const pd = Math.max(1, Math.floor(L * o.pos));
  let mean = 0;
  for (let i = 0; i <= L; i++) mean += exc[i];
  mean /= L + 1;
  let apIn = 0;
  let apOut = 0;
  for (let i = 0; i < n; i++) {
    let x = 0;
    if (i <= L) x = exc[i] - mean - (i >= pd ? exc[i - pd] - mean : 0);
    const d1 = i - L >= 0 ? y[i - L] : 0;
    const d2 = i - L - 1 >= 0 ? y[i - L - 1] : 0;
    const lpv = (1 - s) * d1 + s * d2;
    const ap = C * lpv + apIn - C * apOut;
    apIn = lpv;
    apOut = ap;
    y[i] = x + g * ap;
  }
  return y;
}

export function ks(sr: number, f: number, o: KsOpts): Float32Array {
  const y = ksString(sr, f, o, o.seed ?? Math.round(f * 7));
  if (o.detune) {
    const y2 = ksString(sr, f * Math.pow(2, o.detune / 1200), o, (o.seed ?? 3) + 991);
    for (let i = 0; i < y.length; i++) y[i] = 0.55 * (y[i] + y2[i]);
  }
  // Remove DC and soften the highest frequencies
  const hp = new Biquad(sr, 'hp', 40);
  const lpf = new Biquad(sr, 'lp', Math.min(12000, f * 24));
  for (let i = 0; i < y.length; i++) y[i] = lpf.run(hp.run(y[i]));
  return tailFade(normalize(y), sr);
}

// ───────────────────────── Plucked string (additive): bass plucks ─────────────────────────

export interface PluckOpts {
  len: number;
  /** Seconds for the fundamental to decay to -60 dB; higher harmonics progressively faster */
  t60: number;
  /** Pluck position 0-0.5 (decides which harmonics are weakened) */
  pos: number;
  /** Harmonic slope (the larger, the darker) */
  tilt: number;
  /** Frequencies of the body resonances (Hz): they sound together at the instant of the pluck and vanish quickly */
  body: number[];
  /** Amount of the finger's dull thump */
  thump: number;
}

/**
 * Additive-synthesis plucked string: each harmonic decays on its own (the higher, the faster), slightly inharmonic, plus body resonance and the finger's dull thump.
 * In the bass range Karplus-Strong decays down to a pure sine (like a synthesizer); this model keeps the woody mid-range.
 */
export function pluckAdd(sr: number, f: number, o: PluckOpts): Float32Array {
  const n = Math.floor(o.len * sr);
  const y = new Float32Array(n);
  const nyq = Math.min(sr * 0.42, 7000);
  const B = 0.00012;
  const r = rng(Math.round(f * 11));
  for (let h = 1; h <= 40; h++) {
    const fh = h * f * Math.sqrt(1 + B * h * h);
    if (fh > nyq) break;
    const amp = (Math.abs(Math.sin(Math.PI * h * o.pos)) + 0.05) / Math.pow(h, o.tilt);
    const t60 = o.t60 / (1 + 0.45 * (h - 1));
    const k = Math.pow(10, -3 / (t60 * sr));
    const w = (2 * Math.PI * fh) / sr;
    let env = amp;
    let ph = r() * 0.2;
    for (let i = 0; i < n && env > 1e-6; i++) {
      ph += w;
      y[i] += Math.sin(ph) * env;
      env *= k;
    }
  }
  for (const hz of o.body) {
    const w = (2 * Math.PI * hz) / sr;
    const k = Math.pow(10, -3 / (0.22 * sr));
    let env = 0.35;
    for (let i = 0; i < n && env > 1e-6; i++) {
      y[i] += Math.sin(w * i) * env;
      env *= k;
    }
  }
  const lp = new Biquad(sr, 'lp', 350, 0.7);
  const kt = Math.pow(10, -3 / (0.05 * sr));
  let env = o.thump;
  for (let i = 0; i < n && env > 1e-6; i++) {
    y[i] += lp.run(r()) * env * 3;
    env *= kt;
  }
  const att = Math.floor(sr * 0.003);
  for (let i = 0; i < att && i < n; i++) y[i] *= i / att;
  return tailFade(normalize(y), sr);
}
