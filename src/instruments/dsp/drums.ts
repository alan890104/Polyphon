// Drum kit and percussion: membrane modes for drum bodies, filtered noise for snares and shakers, blooming bands of noise and 808-style metal for cymbals.

import { Biquad, normalize, rng, tailFade } from './core.ts';
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

/** A band of a cymbal's wash: [centre Hz, level, bloom seconds, T60 seconds] */
type WashBand = [number, number, number, number];

/**
 * A cymbal's wash: its thousands of closely spaced modes, as bands of noise, with metal's square-wave tones mixed into the bands above 3 kHz.
 * The stick excites the low modes first and the plate's nonlinearity hands the energy upward over the first tens of milliseconds (the build-up:
 * the higher a band, the later it blooms), while damping grows with frequency, so the highs also die first and the tail settles into a lower hum.
 */
function wash(y: Float32Array, sr: number, seed: number, base: number, metalMix: number, bands: WashBand[]): void {
  const n = y.length;
  const r = rng(seed);
  const nz = new Float32Array(n);
  const sq = new Float32Array(n);
  for (let i = 0; i < n; i++) nz[i] = r();
  for (const ratio of [1, 1.483, 1.804, 2.546, 2.63, 3.897]) {
    const d = (base * ratio) / sr;
    let ph = 0;
    for (let i = 0; i < n; i++) {
      ph += d;
      if (ph >= 1) ph -= 1;
      sq[i] += ph < 0.5 ? 1 / 6 : -1 / 6;
    }
  }
  for (const [fc, level, bloom, t60] of bands) {
    const a = new Biquad(sr, 'bp', fc, 0.9);
    const b = new Biquad(sr, 'bp', fc, 0.9);
    const mix = fc >= 3000 ? metalMix : 0;
    const k = decay(sr, t60);
    const kr = Math.exp(-1 / (bloom * sr));
    let env = level;
    let rise = 1;
    for (let i = 0; i < n && env > 1e-6; i++) {
      y[i] += b.run(a.run(nz[i] + mix * sq[i])) * env * (1 - rise);
      env *= k;
      rise *= kr;
    }
  }
}

/** A well-mixed number in [0, 1) for each variant (the first outputs of rng for nearby seeds are alike) */
function vary(s: number): number {
  const r = rng((s * 2654435761) >>> 0);
  r();
  return (r() + 1) / 2;
}

/** Bessel function of the first kind J_m(x): the shape of a drumhead's modes (integral form) */
function besselJ(m: number, x: number): number {
  let s = 0;
  for (let i = 0; i < 48; i++) {
    const t = (Math.PI * (i + 0.5)) / 48;
    s += Math.cos(m * t - x * Math.sin(t));
  }
  return s / 48;
}

/** A drumhead mode: [frequency ratio, order m, Bessel zero j_mn, radiated weight, T60 seconds] */
type HeadMode = [number, number, number, number, number];

/**
 * A struck drumhead: the modes of a circular membrane, each excited by how far it moves where the stick lands (J_m(j_mn·r/a), r/a = x),
 * all gliding down together. The strike stretches the head and raises its tension with the square of the displacement,
 * so the pitch starts a little high and settles about twice as fast as the sound dies (time constant ≈ T60/14).
 */
function head(y: Float32Array, sr: number, f: number, x: number, modes: HeadMode[], glide: number): void {
  const ref = Math.abs(besselJ(modes[0][1], modes[0][2] * x));
  const tf = modes[0][4] / 14;
  for (const [ratio, m, j, w, t60] of modes) sweep(y, sr, f * ratio * glide, f * ratio, tf, (w * Math.abs(besselJ(m, j * x))) / ref, t60);
}

const sat = (y: Float32Array, drive: number): Float32Array => {
  for (let i = 0; i < y.length; i++) y[i] = Math.tanh(y[i] * drive) / Math.tanh(drive);
  return y;
};

export const DRUMS = {
  /**
   * Kick: a beater on a big, slack head. The body settles at about 52 Hz after a short glide (the strike stretches the head),
   * and the beater's impact is a brief click around 3 kHz, the part of a kick that is heard through a mix.
   */
  kick: (sr, _m, s) => {
    const y = buf(sr, 0.5);
    sweep(y, sr, 130, 52, 0.02, 1, 0.45);
    noiseHit(y, sr, s, [['lp', 6000]], 0.25, 0.012);
    noiseHit(y, sr, s + 1, [['bp', 3200, 0.9]], 0.8 + 0.3 * vary(s), 0.008);
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
  /** Open hi-hat: two small, thin cymbals rattling against each other; their wash blooms within a few milliseconds and the highest band fades first */
  ohat: (sr, _m, s) => {
    const y = buf(sr, 0.6);
    wash(y, sr, s, 330, 1.5, [[2500, 0.02, 0.0005, 0.7], [4500, 0.055, 0.002, 0.6], [7000, 0.17, 0.005, 0.5], [10000, 0.35, 0.01, 0.42], [14000, 0.48, 0.018, 0.34]]);
    noiseHit(y, sr, s + 1, [['hp', 7000]], 0.16, 0.05);
    return tailFade(y, sr);
  },
  /** Ride: a thick cymbal played on the bow. The stick's ping and the bell's tone come first; the wash builds up slowly under them and its highs fade first */
  ride: (sr, _m, s) => {
    const y = buf(sr, 2.2);
    wash(y, sr, s, 410, 1, [[1500, 0.03, 0.001, 2.4], [3000, 0.13, 0.005, 2.2], [5000, 0.22, 0.02, 1.9], [8000, 0.3, 0.045, 1.5], [12000, 0.25, 0.07, 1.1]]);
    sweep(y, sr, 3400, 3400, 1, 0.08, 1.2);
    noiseHit(y, sr, s + 1, [['bp', 5000, 0.8]], 0.3, 0.02);
    return tailFade(y, sr);
  },
  /** Crash: the stick's strike, then the wash blooms upward over the first ~100 ms; the highs fade within about a second and a low hum rings on */
  crash: (sr, _m, s) => {
    const y = buf(sr, 3.2);
    wash(y, sr, s, 290, 0.6, [[450, 0.16, 0.0005, 4], [900, 0.23, 0.001, 3.6], [1800, 0.45, 0.002, 3.2], [3500, 0.9, 0.006, 2.8], [6000, 1, 0.02, 2.2], [9000, 0.95, 0.035, 1.5], [13000, 0.8, 0.05, 1]]);
    noiseHit(y, sr, s + 1, [['bp', 2500, 0.7]], 0.6, 0.03);
    return tailFade(y, sr);
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
  /**
   * Taiko: two thick cowhide heads on a hollowed trunk, struck near the centre with heavy bachi. The deep (0,1) mode carries the sound,
   * the (1,1) and (2,1) above it fade sooner, the slack hide makes the pitch sag as the strike's stretch relaxes, and the hardwood bachi slaps the hide.
   */
  taiko: (sr, m, s) => {
    const y = buf(sr, 1.4);
    const f = m ? 440 * Math.pow(2, (m - 69) / 12) : 62;
    head(y, sr, f, 0.15 + 0.2 * vary(s), [[1, 0, 2.405, 1, 1.1], [1.52, 1, 3.832, 0.6, 0.4], [2.1, 2, 5.136, 0.3, 0.25]], 1.12);
    noiseHit(y, sr, s, [['lp', 900]], 0.5, 0.08);
    noiseHit(y, sr, s + 1, [['bp', 1800, 0.8]], 0.9, 0.02);
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
  /**
   * Tom: a stick on a tensioned head. The (0,1) mode is the pitch; the (1,1), (2,1), (0,2) and (3,1) modes above it (ideal-membrane ratios) die sooner
   * and make it a drum rather than a sine. The strike's stretch raises the pitch about two semitones at first; the stick's tip adds a short slap.
   */
  tom: (sr, m, s) => {
    const y = buf(sr, 0.8);
    const f = m ? 440 * Math.pow(2, (m - 69) / 12) : 110;
    // Bigger, lower toms ring longer
    const t = 0.55 * Math.pow(110 / f, 0.3);
    // The stick lands between the centre and halfway out
    head(y, sr, f, 0.3 + 0.25 * vary(s), [[1, 0, 2.405, 1, t], [1.59, 1, 3.832, 0.5, t * 0.6], [2.14, 2, 5.136, 0.35, t * 0.45], [2.3, 0, 5.52, 0.4, t * 0.35], [2.65, 3, 6.38, 0.25, t * 0.35]], 1.12);
    noiseHit(y, sr, s, [['bp', 1100, 0.8]], 0.2, 0.05);
    noiseHit(y, sr, s + 1, [['bp', 2800, 0.8]], 1.3, 0.015);
    return sat(y, 1.3);
  },
  /**
   * Timpani: the air in the kettle loads the head so that its (1,1) to (5,1) modes fall at about 1 : 1.5 : 1.98 : 2.44 : 2.9 (Rossing),
   * a near-harmonic series that gives the drum its pitch; the (1,1) rings longest (2-3 s, longer on the big drums).
   * The symmetric modes pump air in and out of the kettle and die within a few tenths of a second: with the felt, they are the low thud of the stroke.
   * Each variant lands at a slightly different distance from the rim, which changes how strongly each mode is excited (J_m(j_m1·r/a)), so a roll does not repeat itself.
   */
  timpani: (sr, m, s) => {
    const f = m ? 440 * Math.pow(2, (m - 69) / 12) : 73;
    // Strike point, as a fraction of the radius from the centre: a hand's breadth in from the rim
    const x = 0.6 + 0.1 * vary(s);
    const t11 = 2.4 * Math.pow(110 / f, 0.3);
    // [ratio, order m, Bessel zero j_m1, radiated weight, T60 as a fraction of the (1,1)'s]; the weight is what is left after the felt and the radiation efficiency of each mode
    const series: [number, number, number, number, number][] = [[1, 1, 3.832, 1, 1], [1.5, 2, 5.136, 0.6, 0.65], [1.98, 3, 6.38, 0.45, 0.45], [2.44, 4, 7.588, 0.35, 0.33], [2.9, 5, 8.771, 0.25, 0.25]];
    const ref = besselJ(1, 3.832 * x);
    const parts: ModalPartial[] = series.map(([ratio, mm, j, w, td]) => [ratio, (w * besselJ(mm, j * x)) / ref, t11 * td]);
    // The inharmonic (0,2) and (2,2) modes: excited, but quickly damped by the air
    parts.push([1.74, 0.3 * Math.abs(besselJ(0, 5.52 * x) / ref), 0.4], [2.2, 0.12, 0.35]);
    return modal(sr, f, parts, { len: Math.min(4, t11 + 0.4), bend: 1.03, bendT: 0.03, click: { amp: 0.22, t: 0.08, hz: 1.4, q: 0.8 }, seed: s });
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
