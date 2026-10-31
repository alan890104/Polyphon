// Plucked strings: Karplus-Strong for guitars, harps and dulcimers; an additive model for bass plucks.

import { Biquad, normalize, rng, tailFade } from './core.ts';

// ───────────────────────── Plucked string: Karplus-Strong ─────────────────────────
//
// A digital waveguide string (Karplus-Strong, with an allpass for exact tuning), shaped by what a real pluck does:
// - The pluck: the finger or plectrum draws the string aside into a triangle and lets go. The force on the bridge is then a rectangular wave
//   whose n-th harmonic is ∝ sin(nπ·pos)/n: the overtones fall 6 dB per octave, with gaps at multiples of 1/pos. The string slips off a finger
//   over a fraction of a millisecond (off a nail or plectrum faster), a low-pass on top. Plain Karplus-Strong plucks with noise instead, which
//   leaves every overtone at a random level, some 10-30 dB above the fundamental: a twangy, synthetic tone that changes from note to note.
// - The loss: a string loses energy to the air and to internal friction at a rate that grows with the square of frequency
//   (σ = b1 + b3·ω², Chaigne and Askenfelt), whatever string the partial is on. The plain Karplus-Strong loop filter loses a fixed fraction
//   per round trip instead, so a bass string (a long round trip) keeps its highs ringing like an organ while a treble string collapses to a sine
//   within a few tenths of a second (a 2 kHz partial lasted 4.5 s on the harp's C2 and 0.9 s on its C5). Here the loop filter is a one-pole
//   low-pass designed for each note so that every partial decays at the rate σ prescribes; the fundamental keeps the T60 asked for.
// - The body: the bridge drives the guitar top (the violin body, the harp soundboard). Its response is broadly flat, with strong peaks at the lowest
//   modes (the air in the cavity, the top plate) that lift the partials near them and ring for a moment on their own, knocked by the release of the string.

/** A body mode: [frequency Hz, boost at the peak in dB, Q]; it rings for about 2.2·Q/f seconds */
export type BodyMode = [number, number, number];

/** Classical guitar: the air in the body (~95 Hz) coupled to the top plate (~200 Hz), and the top's next modes around 400 Hz */
export const GUITAR_BODY: BodyMode[] = [[96, 7, 14], [205, 6, 16], [400, 3.5, 12], [560, 2, 10]];
/** Steel-string guitar: a larger, stiffer top braced for the strings' higher tension */
export const STEEL_BODY: BodyMode[] = [[102, 6, 14], [190, 5, 16], [380, 3, 12], [650, 2, 10]];
/** Lute and oud: a light bowl-backed body with a thin top, modes higher than a guitar's */
export const LUTE_BODY: BodyMode[] = [[125, 5, 12], [260, 5, 14], [520, 3, 10]];
/** Violin family (pizzicato): the air mode A0 and the corpus modes B1-, B1+ */
export const VIOLIN_BODY: BodyMode[] = [[275, 6, 12], [460, 5, 14], [540, 4, 14]];
/** Concert harp: the long soundboard and the box behind it */
export const HARP_BODY: BodyMode[] = [[110, 3, 8], [190, 3, 10], [330, 2, 10]];
/** Hammered dulcimer: a shallow trapezoid box */
export const DULCIMER_BODY: BodyMode[] = [[180, 4, 12], [320, 4, 12], [610, 2.5, 10]];

export interface KsOpts {
  /** Length in seconds */
  len: number;
  /** Seconds for the fundamental to decay to -60 dB (at this pitch) */
  t60: number;
  /** How fast the string is let go, 0-1: the pluck's low-pass, from 2 kHz (soft flesh) to 16 kHz (plectrum, hammer) */
  bright: number;
  /** Pluck position as a fraction of the string length, 0-0.5 (the nearer the bridge, the more overtones) */
  pos: number;
  /** Frequency-dependent string loss b3 (s⁻¹ per (rad/s)²): a partial at ω decays b3·(ω² − ω0²) per second faster than the fundamental. 2e-8 lets a 2 kHz partial ring about 1.5 s (steel), 6e-8 about 0.6 s (nylon) */
  loss: number;
  /** Detune of the second string (cents); 0 means a single string */
  detune?: number;
  /** Body modes */
  body?: BodyMode[];
  /** Loudness by register, dB per octave from middle C (the shorter, lighter treble strings move less air) */
  tilt?: number;
}

/**
 * The whole body: the listed low modes, then the many plate and cavity modes above them, too dense to list (24 of them log-spaced up to 4 kHz,
 * -2 to +3 dB, Q 12-30). Each colours the partials near it and rings for some tens of milliseconds, so the bridge's sharp pulse each period
 * comes out as a short wooden ring rather than a bare click train.
 */
function bodyModes(body: BodyMode[]): BodyMode[] {
  const r = rng(Math.round(body[0][0] * 97));
  const lo = body[body.length - 1][0] * 1.25;
  const dense: BodyMode[] = [];
  for (let i = 0; i < 24; i++) dense.push([lo * Math.pow(4000 / lo, (i + 0.5 + 0.4 * r()) / 24), 0.5 + 2.5 * r(), 21 + 9 * r()]);
  return [...body, ...dense];
}

/** Pass x through the body (in place): each mode adds a resonant band-pass, so a mode of gain G dB lifts its frequency by G dB */
function throughBody(sr: number, modes: BodyMode[], x: Float32Array): void {
  const bank = modes.map(([hz, gain, q]) => [new Biquad(sr, 'bp', hz, q), Math.pow(10, gain / 20) - 1] as const);
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    let s = v;
    for (const [bp, k] of bank) s += k * bp.run(v);
    x[i] = s;
  }
}

/** Per round trip, the one-pole loop filter g·(1−p)/(1−p·z⁻¹) passes this much at ω relative to its gain g */
const onePole = (p: number, w: number): number => (1 - p) / Math.sqrt(1 - 2 * p * Math.cos(w) + p * p);

/**
 * One string, heard through the body; returns the output and the bridge force it starts from (its level the instant before the string is let go).
 * Body and string are both linear, so the body can come first (commuted synthesis): it filters the pluck, a fraction of a second long, rather than the whole note.
 */
function ksString(sr: number, f: number, o: KsOpts, body: BodyMode[], ring: number): [Float32Array, number] {
  const n = Math.floor(o.len * sr);
  const y = new Float32Array(n);
  const P = sr / f;
  const w0 = (2 * Math.PI * f) / sr;
  // Decay per second of a partial at x Hz, σ = b1 + b3·ω²: b1 is set so the fundamental keeps the T60 asked for, unless the string's own
  // loss at that frequency is already faster (the top of the harp)
  const b1 = Math.max(0.1, 6.91 / o.t60 - o.loss * Math.pow(2 * Math.PI * f, 2));
  const sigma = (x: number) => b1 + o.loss * Math.pow(2 * Math.PI * x, 2);
  // The loop filter g·(1−p)/(1−p·z⁻¹) loses σ(x)/f per round trip: matched at the fundamental and at a frequency high in the spectrum
  const fr = Math.min(0.4 * sr, Math.max(4000, 3 * f));
  const wr = (2 * Math.PI * fr) / sr;
  const G0 = Math.exp(-sigma(f) / f);
  const want = Math.exp(-(sigma(fr) - sigma(f)) / f);
  let lo = 0;
  let hi = 0.995;
  for (let i = 0; i < 40; i++) {
    const p = (lo + hi) / 2;
    if (onePole(p, wr) / onePole(p, w0) > want) lo = p;
    else hi = p;
  }
  // It must not gain at 0 Hz, where it loses b1 (on the highest strings this caps how fast the highs can die)
  const gMax = Math.exp(-b1 / f);
  if (G0 / onePole(hi, w0) > gMax) {
    lo = 0;
    for (let i = 0; i < 40; i++) {
      const p = (lo + hi) / 2;
      if (G0 / onePole(p, w0) > gMax) hi = p;
      else lo = p;
    }
  }
  const p = lo;
  const g = G0 / onePole(p, w0);
  // Tuning: the loop filter's phase delay at the fundamental comes off the delay line, and an allpass supplies the remaining fraction of a sample
  const tau = Math.atan2(p * Math.sin(w0), 1 - p * Math.cos(w0)) / w0;
  const L = Math.max(2, Math.floor(P - tau - 0.2));
  const frac = P - tau - L;
  const C = (1 - frac) / (1 + frac);
  // The pluck: one period of the bridge force, summed from its harmonics (a rectangular wave of duty pos, centred on the start, rounded by the release)
  const fc = 2000 * Math.pow(8, o.bright);
  const exc = new Float32Array(L + 1 + ring);
  for (let h = 1; h * f < sr * 0.45; h++) {
    const a = (2 * Math.sin(Math.PI * h * o.pos)) / (Math.PI * h) / Math.sqrt(1 + Math.pow((h * f) / fc, 2));
    const dw = (2 * Math.PI * h) / P;
    for (let i = 0; i <= L; i++) exc[i] += a * Math.cos(dw * i);
  }
  const held = exc[0];
  throughBody(sr, body, exc);
  let lpv = 0;
  let apIn = 0;
  let apOut = 0;
  for (let i = 0; i < n; i++) {
    const d = i >= L ? y[i - L] : 0;
    lpv = (1 - p) * d + p * lpv;
    const ap = C * lpv + apIn - C * apOut;
    apIn = lpv;
    apOut = ap;
    y[i] = (i < exc.length ? exc[i] : 0) + g * ap;
  }
  return [y, held];
}

/** A plucked string (or a course of two) through its instrument's body */
export function ks(sr: number, f: number, o: KsOpts): Float32Array {
  const body = o.body ? bodyModes(o.body) : [];
  const ring = Math.ceil(sr * Math.max(0, ...body.map(([hz, , q]) => (2.6 * q) / hz)));
  const [y, held1] = ksString(sr, f, o, body, ring);
  let held = held1;
  if (o.detune) {
    const [y2, held2] = ksString(sr, f * Math.pow(2, o.detune / 1200), o, body, ring);
    for (let i = 0; i < y.length; i++) y[i] = 0.55 * (y[i] + y2[i]);
    held = 0.55 * (held1 + held2);
  }
  // Before the release the finger holds the string with a steady force on the bridge, which makes no sound. Measured from there the sound
  // starts from silence (no click), and letting go is a sudden push on the body; the body radiates poorly below its air mode, so the push
  // fades within a couple of milliseconds, knocking the body modes on its way
  const knock = new Float32Array(Math.min(y.length, Math.floor(sr * 0.02) + ring));
  const kd = Math.exp((-2 * Math.PI * 90) / sr);
  for (let i = 0; i < knock.length; i++, held *= kd) knock[i] = -held;
  throughBody(sr, body, knock);
  for (let i = 0; i < knock.length; i++) y[i] += knock[i];
  // Remove DC and soften the highest frequencies
  const hp = new Biquad(sr, 'hp', 40);
  const lpf = new Biquad(sr, 'lp', 12000);
  for (let i = 0; i < y.length; i++) y[i] = lpf.run(hp.run(y[i]));
  // Loudness is set by the energy of the first half second rather than the peak (which the sharp edge of the pluck decides), falling by tilt dB per octave
  const w = Math.min(y.length, Math.floor(sr * 0.5));
  let e = 0;
  for (let i = 0; i < w; i++) e += y[i] * y[i];
  const k = (0.2 * Math.pow(10, ((o.tilt ?? 0) * Math.log2(f / 261.63)) / 20)) / (Math.sqrt(e / w) || 1);
  for (let i = 0; i < y.length; i++) y[i] *= k;
  return tailFade(y, sr);
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
