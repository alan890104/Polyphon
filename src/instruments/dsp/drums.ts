// Drum kit and percussion: swept sines for drum bodies, filtered noise for snares and shakers, 808-style metal for cymbals.

import { Biquad, normalize, rng } from './core.ts';
import { modal, type ModalPartial } from './modal.ts';

type Gen = (sr: number, m: number, seed: number) => Float32Array;

function buf(sr: number, len: number): Float32Array {
  return new Float32Array(Math.floor(sr * len));
}
const decay = (sr: number, t60: number) => Math.pow(10, -3 / (t60 * sr));

/** Swept sine (the drum body) */
function sweep(y: Float32Array, sr: number, f0: number, f1: number, tf: number, amp: number, t60: number, delay = 0): void {
  let ph = 0;
  let env = amp;
  const k = decay(sr, t60);
  for (let i = Math.floor(delay * sr); i < y.length; i++) {
    const t = i / sr - delay;
    const f = f1 + (f0 - f1) * Math.exp(-t / tf);
    ph += (2 * Math.PI * f) / sr;
    y[i] += Math.sin(ph) * env;
    env *= k;
    if (env < 1e-6) break;
  }
}

/** One hit of filtered noise */
function noiseHit(y: Float32Array, sr: number, seed: number, filters: [type: 'lp' | 'hp' | 'bp', f: number, q?: number][], amp: number, t60: number, attack = 0.0005, delay = 0): void {
  const r = rng(seed);
  const fl = filters.map(([t, f, q]) => new Biquad(sr, t, f, q ?? 0.8));
  const k = decay(sr, t60);
  let env = amp;
  const a = Math.max(1, attack * sr);
  const d0 = Math.floor(delay * sr);
  for (let i = d0; i < y.length; i++) {
    let x = r();
    for (const f of fl) x = f.run(x);
    const j = i - d0;
    y[i] += x * env * (j < a ? j / a : 1);
    if (j >= a) env *= k;
    if (env < 1e-6) break;
  }
}

/** 808-style metallic tone: six square waves (cymbal, tambourine) */
function metal(y: Float32Array, sr: number, base: number, amp: number, t60: number, hp: number, delay = 0): void {
  const ratios = [1, 1.483, 1.804, 2.546, 2.63, 3.897];
  const k = decay(sr, t60);
  const phs = ratios.map(() => 0);
  const bpf = new Biquad(sr, 'hp', hp, 0.7);
  const bp2 = new Biquad(sr, 'hp', hp, 0.7);
  let env = amp;
  for (let i = Math.floor(delay * sr); i < y.length; i++) {
    let x = 0;
    for (let j = 0; j < ratios.length; j++) {
      phs[j] += (base * ratios[j]) / sr;
      x += phs[j] % 1 < 0.5 ? 1 : -1;
    }
    y[i] += bp2.run(bpf.run(x / 6)) * env;
    env *= k;
    if (env < 1e-6) break;
  }
}

const sat = (y: Float32Array, drive: number): Float32Array => {
  for (let i = 0; i < y.length; i++) y[i] = Math.tanh(y[i] * drive) / Math.tanh(drive);
  return y;
};

export const DRUMS = {
  kick: (sr, _m, s) => {
    const y = buf(sr, 0.5);
    sweep(y, sr, 170, 46, 0.03, 1, 0.45);
    noiseHit(y, sr, s, [['lp', 6000]], 0.25, 0.012);
    return sat(y, 1.6);
  },
  /** Long-tailed bass drum (the ground rumble of electronic and epic music) */
  boom: (sr, _m, s) => {
    const y = buf(sr, 1.6);
    sweep(y, sr, 110, 34, 0.09, 1, 1.4);
    noiseHit(y, sr, s, [['lp', 900]], 0.3, 0.3, 0.002);
    return sat(y, 1.3);
  },
  snare: (sr, _m, s) => {
    const y = buf(sr, 0.45);
    sweep(y, sr, 260, 180, 0.02, 0.55, 0.14);
    sweep(y, sr, 400, 330, 0.02, 0.2, 0.08);
    noiseHit(y, sr, s, [['hp', 1400], ['lp', 9500]], 0.75, 0.28);
    return sat(y, 1.4);
  },
  /** Field snare (march, epic): the long tail of the snare wires */
  field: (sr, _m, s) => {
    const y = buf(sr, 0.7);
    sweep(y, sr, 230, 170, 0.03, 0.4, 0.2);
    noiseHit(y, sr, s, [['hp', 900], ['lp', 7000], ['bp', 3200, 0.6]], 0.8, 0.55);
    return y;
  },
  rim: (sr, _m, s) => {
    const y = buf(sr, 0.15);
    sweep(y, sr, 520, 500, 0.01, 0.5, 0.05);
    noiseHit(y, sr, s, [['bp', 1800, 2]], 0.8, 0.03);
    return y;
  },
  clap: (sr, _m, s) => {
    const y = buf(sr, 0.5);
    for (let i = 0; i < 4; i++) noiseHit(y, sr, s + i, [['bp', 1250, 1.4]], i === 3 ? 0.9 : 0.55, i === 3 ? 0.25 : 0.02, 0.0005, i * 0.009);
    return y;
  },
  hat: (sr, _m, s) => {
    const y = buf(sr, 0.12);
    metal(y, sr, 330, 0.7, 0.05, 7000);
    noiseHit(y, sr, s, [['hp', 8000]], 0.25, 0.04);
    return y;
  },
  ohat: (sr, _m, s) => {
    const y = buf(sr, 0.6);
    metal(y, sr, 330, 0.6, 0.45, 6500);
    noiseHit(y, sr, s, [['hp', 7000]], 0.2, 0.35);
    return y;
  },
  ride: (sr, _m, s) => {
    const y = buf(sr, 2.2);
    metal(y, sr, 410, 0.35, 1.8, 4000);
    sweep(y, sr, 3400, 3400, 1, 0.08, 1.2);
    noiseHit(y, sr, s, [['hp', 6000]], 0.1, 0.6);
    return y;
  },
  crash: (sr, _m, s) => {
    const y = buf(sr, 3.2);
    metal(y, sr, 290, 0.35, 2.4, 3500);
    noiseHit(y, sr, s, [['hp', 3000], ['lp', 12000]], 0.7, 2.6, 0.003);
    return y;
  },
  /** Reversed cymbal: sucked in toward the next beat */
  swell: (sr, m, s): Float32Array => {
    const y: Float32Array = DRUMS.crash(sr, m, s).slice(0, Math.floor(sr * 1.6));
    y.reverse();
    const n = Math.floor(sr * 0.01);
    for (let i = 0; i < n; i++) y[y.length - 1 - i] *= i / n;
    return y;
  },
  shaker: (sr, _m, s) => {
    const y = buf(sr, 0.14);
    noiseHit(y, sr, s, [['bp', 6500, 1.1], ['hp', 3500]], 0.9, 0.07, 0.012);
    return y;
  },
  tamb: (sr, _m, s) => {
    const y = buf(sr, 0.35);
    for (let i = 0; i < 3; i++) metal(y, sr, 520 + i * 37, 0.3, 0.18, 7500, i * 0.006);
    noiseHit(y, sr, s, [['hp', 6000]], 0.3, 0.16);
    return y;
  },
  /** Taiko: big and low, the slap of leather + a long drum body */
  taiko: (sr, m, s) => {
    const y = buf(sr, 1.4);
    const f = m ? 440 * Math.pow(2, (m - 69) / 12) : 62;
    sweep(y, sr, f * 1.6, f, 0.025, 1, 1.1);
    sweep(y, sr, f * 2.6, f * 1.52, 0.02, 0.25, 0.4);
    noiseHit(y, sr, s, [['lp', 900]], 0.5, 0.08);
    noiseHit(y, sr, s + 1, [['bp', 2200, 0.8]], 0.12, 0.03);
    return sat(y, 1.5);
  },
  /** Frame drum (a tambourine without jingles, the hand drum): a low thud + the slap of fingers */
  frame: (sr, m, s) => {
    const y = buf(sr, 0.6);
    const f = m ? 440 * Math.pow(2, (m - 69) / 12) : 95;
    sweep(y, sr, f * 1.3, f, 0.02, 0.8, 0.45);
    noiseHit(y, sr, s, [['bp', 1400, 1]], 0.35, 0.03);
    return y;
  },
  /** Darbuka: below C4 is the doum (low), above is the tek (high, crisp) */
  darbuka: (sr, m, s) => {
    const y = buf(sr, 0.5);
    if (m && m < 60) {
      sweep(y, sr, 150, 105, 0.02, 1, 0.4);
      noiseHit(y, sr, s, [['lp', 1200]], 0.2, 0.03);
    } else {
      sweep(y, sr, 900, 820, 0.01, 0.4, 0.06);
      noiseHit(y, sr, s, [['bp', 3200, 1.4]], 0.9, 0.025);
    }
    return y;
  },
  tom: (sr, m, s) => {
    const y = buf(sr, 0.8);
    const f = m ? 440 * Math.pow(2, (m - 69) / 12) : 110;
    sweep(y, sr, f * 1.5, f, 0.04, 1, 0.55);
    noiseHit(y, sr, s, [['bp', 1100, 0.8]], 0.2, 0.05);
    return sat(y, 1.3);
  },
  /** Timpani: slightly inharmonic partials, mallet-head noise */
  timpani: (sr, m, s) => {
    const f = m ? 440 * Math.pow(2, (m - 69) / 12) : 73;
    const y = modal(sr, f, [[1, 1, 2.2], [1.504, 0.55, 1.4], [1.742, 0.3, 1.1], [2.0, 0.25, 0.9], [2.245, 0.15, 0.7]], { len: 2.4, bend: 1.03, bendT: 0.03, click: { amp: 0.25, t: 0.06, hz: 380, q: 0.7 }, seed: s });
    return y;
  },
  woodblock: (sr, m, s) => {
    const f = m ? 440 * Math.pow(2, (m - 69) / 12) : 1100;
    return modal(sr, f, [[1, 1, 0.09], [2.53, 0.3, 0.05]], { len: 0.2, click: { amp: 0.3, t: 0.01, hz: 3000 }, seed: s });
  },
  clave: (sr, _m, s) => modal(sr, 2500, [[1, 1, 0.12], [2.7, 0.2, 0.05]], { len: 0.2, seed: s }),
  /** Anvil: a smith's metallic strike (by pitch) */
  anvil: (sr, m, s) => {
    const f = m ? 440 * Math.pow(2, (m - 69) / 12) : 1320;
    return modal(sr, f, [[1, 1, 1.8], [2.03, 0.5, 1.2], [3.31, 0.35, 0.8], [4.62, 0.2, 0.5], [6.9, 0.12, 0.3]], { len: 2, beat: 3, click: { amp: 0.8, t: 0.012, hz: 5000, q: 0.6 }, seed: s });
  },
  /** Gong (tam-tam): a metallic cloud that slowly blooms */
  gong: (sr, m, s) => {
    const f = m ? 440 * Math.pow(2, (m - 69) / 12) : 90;
    const r = rng(s + 5);
    const parts: ModalPartial[] = [];
    for (let i = 0; i < 26; i++) parts.push([1 + i * 0.37 + r() * 0.15 + (i > 6 ? i * i * 0.02 : 0), 1 / (1 + i * 0.25), 5 - i * 0.12]);
    const y = modal(sr, f, parts, { len: 6, attack: 0.25, beat: 4, seed: s });
    return y;
  },
  /** Thunder: distant rolling low frequencies */
  thunder: (sr, _m, s) => {
    const y = buf(sr, 5);
    const r = rng(s);
    const lp = new Biquad(sr, 'lp', 260, 0.7);
    const lp2 = new Biquad(sr, 'lp', 400, 0.7);
    let env = 0;
    let target = 1;
    let brown = 0;
    for (let i = 0; i < y.length; i++) {
      const t = i / sr;
      if (i % 2400 === 0) target = Math.max(0, 1 - t / 4.5) * (0.4 + 0.6 * Math.abs(r()));
      env += (target - env) * 0.0008;
      brown = brown * 0.985 + r() * 0.15;
      y[i] = lp2.run(lp.run(brown)) * env * (t < 0.05 ? t / 0.05 : 1);
    }
    noiseHit(y, sr, s + 3, [['bp', 700, 0.6]], 0.25, 0.4, 0.004);
    return normalize(y);
  },
  /** Close thunderclap: first a tearing crack, then right after a dull boom, then rolling out into several waves of thunder from near to far */
  thunderclap: (sr, _m, s) => {
    const y = buf(sr, 6);
    const r = rng(s);
    noiseHit(y, sr, s, [['hp', 900]], 1, 0.35, 0.0005);
    let t = 0.01;
    for (let i = 0; i < 14; i++) {
      t += 0.008 + Math.abs(r()) * 0.03 * (1 + i * 0.25);
      noiseHit(y, sr, s + 10 + i, [['bp', 1800 + Math.abs(r()) * 3000, 0.9]], 0.5 * Math.pow(0.85, i), 0.06, 0.0003, t);
    }
    noiseHit(y, sr, s + 40, [['lp', 180], ['lp', 180]], 1.4, 1.6, 0.004, 0.02);
    const lp = new Biquad(sr, 'lp', 320, 0.7);
    const lp2 = new Biquad(sr, 'lp', 500, 0.7);
    let env = 0;
    let target = 1;
    let brown = 0;
    for (let i = 0; i < y.length; i++) {
      const tt = i / sr;
      if (i % 3000 === 0) target = Math.max(0, 1 - tt / 5.5) * (0.3 + 0.7 * Math.abs(r()));
      env += (target - env) * 0.0006;
      brown = brown * 0.985 + r() * 0.15;
      y[i] += lp2.run(lp.run(brown)) * env * 2.2 * Math.min(1, tt / 0.15);
    }
    return normalize(sat(y, 1.2));
  },
  /** Chains clashing */
  chain: (sr, _m, s) => {
    const y = buf(sr, 0.6);
    const r = rng(s);
    for (let i = 0; i < 9; i++) {
      const t = Math.abs(r()) * 0.35;
      const f = 2200 + Math.abs(r()) * 3000;
      const part = modal(sr, f, [[1, 1, 0.12], [1.7, 0.6, 0.08], [2.9, 0.3, 0.05]], { len: 0.2, seed: s + i });
      const off = Math.floor(t * sr);
      for (let j = 0; j < part.length && off + j < y.length; j++) y[off + j] += part[j] * (0.3 + 0.2 * Math.abs(r()));
    }
    return normalize(y);
  },
  /** Finger castanets / finger snap */
  snap: (sr, _m, s) => {
    const y = buf(sr, 0.12);
    noiseHit(y, sr, s, [['bp', 2600, 3]], 1, 0.025);
    return y;
  },
  /** A brush sweeping past, like a maidenhair fern (jazz brush) */
  brush: (sr, _m, s) => {
    const y = buf(sr, 0.3);
    noiseHit(y, sr, s, [['bp', 4200, 0.7]], 0.8, 0.18, 0.03);
    return y;
  },
  /** Water drop */
  drip: (sr, m, s) => {
    const y = buf(sr, 0.4);
    const f = m ? 440 * Math.pow(2, (m - 69) / 12) : 1400;
    let ph = 0;
    let env = 1;
    const k = decay(sr, 0.12);
    for (let i = 0; i < y.length; i++) {
      const t = i / sr;
      ph += (2 * Math.PI * f * (1 + 1.6 * Math.exp(-t / 0.012))) / sr;
      y[i] = Math.sin(ph) * env * Math.min(1, t / 0.001);
      env *= k;
    }
    void s;
    return y;
  },
} satisfies Record<string, Gen>;
