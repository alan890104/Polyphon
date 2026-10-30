// Procedural reverb: a stereo impulse response of decaying noise whose highs fade faster than its lows.

import { rng } from './core.ts';

/** The acoustic space a song plays in */
export interface Room {
  /** Reverb time (seconds, decay by 60 dB) */
  size: number;
  /** 0 bright to 1 dark (how fast the highs decay; default 0.45) */
  damp?: number;
  /** Pre-delay (seconds; default 0.012) */
  preDelay?: number;
  /** Early reflection amount 0-1 (default 0.3) */
  early?: number;
  /** Attack time (seconds); above 0 it is a reverb that "grows in" (a reversed, ghostly feel) */
  bloom?: number;
}

/** Generate a stereo impulse response: decaying noise, with the highs eaten away over time */
export function impulse(sr: number, o: Room): [Float32Array, Float32Array] {
  const len = Math.floor(sr * Math.min(8, o.size * 1.15 + (o.preDelay ?? 0) + 0.05));
  const pre = Math.floor((o.preDelay ?? 0.012) * sr);
  const damp = o.damp ?? 0.45;
  const out: [Float32Array, Float32Array] = [new Float32Array(len), new Float32Array(len)];
  for (let ch = 0; ch < 2; ch++) {
    const r = rng(1234 + ch * 777);
    const d = out[ch];
    const k = Math.pow(10, -3 / (o.size * sr));
    let env = 1;
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr;
      // The low-pass coefficient shrinks over time: darker toward the end
      const a = Math.max(0.02, (1 - damp * 0.85) * Math.exp((-t * damp * 3) / Math.max(0.5, o.size)));
      lp += a * (r() - lp);
      let v = lp * env;
      if (o.bloom) v *= 1 - Math.exp(-t / o.bloom);
      d[i] = v;
      env *= k;
    }
    // Early reflections
    const er = o.early ?? 0.3;
    if (er > 0) {
      for (let j = 0; j < 8; j++) {
        const at = pre + Math.floor((0.004 + Math.abs(r()) * 0.06) * sr);
        if (at < len) d[at] += er * (0.5 + 0.5 * Math.abs(r())) * (r() > 0 ? 1 : -1) * 0.6;
      }
    }
  }
  // Energy normalization: rooms of different sizes come out equally loud
  let e = 0;
  for (const d of out) for (let i = 0; i < d.length; i++) e += d[i] * d[i];
  const g = 1 / Math.sqrt(e / 2 + 1e-9);
  for (const d of out) for (let i = 0; i < d.length; i++) d[i] *= g * 0.5;
  return out;
}
