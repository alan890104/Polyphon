// Acoustic piano (modal, calibrated against real pianos) and electric piano (FM).

import { Biquad, normalize, rng, tailFade } from './core.ts';

//
// Modal synthesis: each partial of each string is a decaying oscillator. The parameters are calibrated against measurements of real pianos and piano recordings from Apple Loops:
// - 1 to 3 strings per note (1 for the bass, 2 for the low-mid, 3 for the rest); each string is out of tune by a fraction of a cent and has a slightly different inharmonicity coefficient,
//   and the beating between partials makes the sound alive rather than an electronic organ.
// - Two-stage decay: the vertical vibration of the string hands its energy quickly to the soundboard (dropping about 12 dB right after the attack), while the horizontal vibration leaves a long tail;
//   high partials get an extra loss proportional to the square of frequency (the Chaigne and Askenfelt string damping model).
// - Excitation spectrum: partial amplitude is about inversely proportional to the square root of frequency, then falls away past a knee; the hammer strikes at about 1/8 to 1/13 of the string length, so partials near that point are weak.
//   The sample is struck brightest (forte) and at playback is rolled off with a low-pass according to velocity (tone in instruments.ts): a light touch is dark, a hard strike bright.
// - Soundboard: a fixed set of resonance peaks shapes the body's timbre; on the attack, the low-frequency thud of the soundboard being struck, and the hammer's brief scrape.
// - Stretch tuning: bass slightly flat and treble slightly sharp (the Railsback curve), so octaves do not clash because of inharmonicity.

/** Stretch tuning (cents) */
export function pianoStretch(m: number): number {
  const d = m - 64;
  return Math.sign(d) * 0.004 * Math.pow(Math.abs(d), 2.2);
}

/** Inharmonicity coefficient: smallest in the low-mid register, growing toward the lowest notes and the treble */
function pianoB(m: number): number {
  return m <= 40 ? 6e-5 * Math.pow(2, (40 - m) / 14) : 6e-5 * Math.pow(2, (m - 40) / 9.3);
}

/** Seconds for the tail to decay 60 dB (fundamental) */
export const pianoSustain = (m: number): number => Math.min(30, Math.max(0.9, 30 * Math.pow(2, -(m - 21) / 19)));

/** Frequency response of the soundboard and body (dB): shared by every note of the same piano */
let boardDb: ((f: number) => number) | null = null;
function board(f: number): number {
  if (!boardDb) {
    const r = rng(90210);
    const modes: [number, number, number][] = [];
    for (let i = 0; i < 34; i++) {
      const fc = 70 * Math.pow(3200 / 70, (i + 0.5 + r() * 0.45) / 34);
      modes.push([fc, 4.5 * r(), 3 + 4 * Math.abs(r())]);
    }
    boardDb = (x) => {
      let g = 0;
      for (const [fc, gain, q] of modes) {
        const u = ((x - fc) * 2 * q) / fc;
        g += gain / (1 + u * u);
      }
      return g;
    };
  }
  // The soundboard radiates poorly at very low frequencies: it drops 12 dB per octave below 45 Hz
  const hp = 1 / Math.sqrt(1 + Math.pow(45 / f, 4));
  return Math.pow(10, boardDb(f) / 20) * hp;
}

/** Piano sample: soft is the soft voicing (felt, warm, used for narrative and the ending) */
export function piano(sr: number, m: number, soft = false): Float32Array {
  const r = rng(m * 31 + (soft ? 7 : 0));
  const f0 = 440 * Math.pow(2, (m - 69 + pianoStretch(m) / 100) / 12);
  const Ts = pianoSustain(m);
  const len = Math.min(9, Math.max(1.6, Ts * 0.85));
  const n = Math.floor(len * sr);
  const acc = new Float64Array(n);
  const nyq = sr * 0.45;
  const B = pianoB(m);
  // Strings: how many, each one's detuning (cents), and the differences in inharmonicity coefficient
  const nStr = m < 30 ? 1 : m < 42 ? 2 : 3;
  const strings: [number, number][] = [];
  for (let k = 0; k < nStr; k++) {
    const cents = nStr === 1 ? 0 : (k - (nStr - 1) / 2) * (0.9 + 0.6 * r()) + 0.35 * r();
    strings.push([f0 * Math.pow(2, cents / 1200), B * (1 + 0.02 * r())]);
  }
  // The knee of the excitation spectrum moves up with pitch; the soft voicing is darker
  const oct = Math.pow(2, (m - 40) / 24);
  const fk = (soft ? 650 : 1200) * oct;
  const fe = (soft ? 1700 : 3000) * oct;
  // Hammer strike point (as a fraction of string length): about 1/8 for the bass, about 1/13 for the treble
  const beta = 1 / (8 + Math.max(0, m - 21) * 0.058);
  // Decay: σ = base loss + b3·ω²; the early stage (handed over to the soundboard) is fast, the later stage (the tail) is slow
  const Tf = Ts / 3.2;
  const prompt = soft ? 0.66 : 0.72;
  const b3 = soft ? 1.4e-9 : 0.9e-9;
  for (let p = 1; p < 400; p++) {
    const fp = p * f0 * Math.sqrt(1 + B * p * p);
    if (fp > nyq) break;
    const lp = 1 / (1 + (fp / fk) * (fp / fk));
    const ex = Math.exp(-fp / fe);
    let amp = Math.sqrt((f0 / fp) * lp * ex);
    amp *= Math.abs(Math.sin(Math.PI * p * beta)) * 0.92 + 0.08;
    amp *= board(fp);
    if (amp < 3e-4) {
      if (fp > fk * 4) break;
      continue;
    }
    const w2 = Math.pow(2 * Math.PI * fp, 2);
    const s1 = 6.9 / Tf + b3 * w2;
    const s2 = 6.9 / Ts + b3 * w2;
    const k1 = Math.exp(-s1 / sr);
    const k2 = Math.exp(-s2 / sr);
    for (const [fs, Bs] of strings) {
      // Each partial is also shifted a tiny bit (string non-uniformity, bridge coupling), so the beats between strings do not all cancel neatly together
      const jit = nStr > 1 ? Math.pow(2, (0.45 * r()) / 1200) : 1;
      const w = (2 * Math.PI * p * fs * jit * Math.sqrt(1 + Bs * p * p)) / sr;
      const cw = Math.cos(w);
      const sw = Math.sin(w);
      // A struck string starts from rest: every partial starts from sin 0
      let re = 1;
      let im = 0;
      let e1 = (amp * prompt) / nStr;
      let e2 = (amp * (1 - prompt)) / nStr;
      const stop = amp * 1e-4 / nStr;
      for (let i = 0; i < n; i++) {
        acc[i] += im * (e1 + e2);
        const nr = re * cw - im * sw;
        im = re * sw + im * cw;
        re = nr;
        e1 *= k1;
        e2 *= k2;
        if (e1 + e2 < stop) break;
      }
    }
  }
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) y[i] = acc[i];
  // Set the volume by the energy in the first 0.25 s after the attack (rather than the peak): every note sounds equally loud, and loudness is left to playback velocity
  let e = 0;
  const w = Math.min(n, Math.floor(sr * 0.25));
  for (let i = 0; i < w; i++) e += y[i] * y[i];
  const rms = Math.sqrt(e / w) || 1;
  // The soundboard thud when struck: a few low-frequency soundboard modes, brief; relatively noticeable in the treble (short strings, quiet string sound)
  const knockAmp = rms * (soft ? 0.35 : 0.55) * Math.min(1.6, Math.max(0.5, (m - 30) / 40));
  const knock: [number, number, number][] = [[96, 0.13, 1], [168, 0.09, 0.8], [281, 0.06, 0.6], [470, 0.035, 0.4]];
  for (const [fq, dec, a] of knock) {
    const bp = new Biquad(sr, 'bp', fq, 2.2);
    const kd = Math.pow(10, -3 / (dec * sr));
    let env = knockAmp * a * 6;
    for (let i = 0; i < n && env > 1e-6; i++) {
      y[i] += bp.run(r()) * env;
      env *= kd;
    }
  }
  // The hammer's scrape: mid-high frequencies, a few milliseconds
  const hb = new Biquad(sr, 'bp', Math.min(5000, 1400 + f0 * 2), 0.9);
  let he = rms * (soft ? 0.25 : 0.6);
  const hk = Math.pow(10, -3 / (0.006 * sr));
  for (let i = 0; i < n && he > 1e-6; i++) {
    y[i] += hb.run(r()) * he;
    he *= hk;
  }
  // Attack: it takes a moment for the hammer to push the string away (longer with the soft voicing's felt)
  const att = Math.floor(sr * (soft ? 0.004 : 0.0015));
  for (let i = 0; i < att && i < n; i++) y[i] *= i / att;
  const g = 0.25 / rms;
  for (let i = 0; i < n; i++) y[i] *= g;
  return tailFade(y, sr);
}

/** Electric piano (Rhodes feel): 1:1 FM, modulation index decaying over time, plus a tuning-fork tine ring in the highs */
export function epiano(sr: number, m: number): Float32Array {
  const f = 440 * Math.pow(2, (m - 69) / 12);
  const t60 = Math.max(1.2, 6 * Math.pow(0.5, (m - 48) / 24));
  const len = Math.min(5, t60 * 0.8);
  const n = Math.floor(len * sr);
  const y = new Float32Array(n);
  const w = (2 * Math.PI * f) / sr;
  const k = Math.pow(10, -3 / (t60 * sr));
  const kt = Math.pow(10, -3 / (0.35 * sr));
  let env = 1;
  let tine = 0.12;
  let pc = 0;
  let pm = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const I = 1.6 * Math.exp(-t / 0.3) + 0.35;
    pc += w;
    pm += w;
    y[i] = Math.sin(pc + I * Math.sin(pm)) * env + Math.sin(pc * 7.1) * tine;
    env *= k;
    tine *= kt;
  }
  const att = Math.floor(sr * 0.003);
  for (let i = 0; i < att; i++) y[i] *= i / att;
  return tailFade(normalize(y), sr);
}
