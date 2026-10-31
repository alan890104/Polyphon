// Offline synthesis of bowed string instruments: the whole of "a group of players bowing one note" is computed in advance, so playback only plays a sample and uses almost no CPU at runtime.
//
// Comparing against the spectra of real string recordings, there are three reasons the synthesized strings sound like brass:
//   1. Too clean: the overtones of real strings are smeared bands, with the scraping noise of the bow hair filling the space between partials; the synthesized ones are thin lines with pure black in between.
//   2. The ensemble is too fake: every player has different intonation, vibrato speed and bowing position, so the high partials spread out; two oscillators vibrating in sync are just a chorus.
//   3. The body is not messy enough: a wooden body has dozens of narrow, irregular resonances, and as the vibrato sweeps the partials across them their strength keeps flickering.
// So here every player is computed separately: a fixed intonation offset, slowly drifting intonation, their own vibrato, their own bowing point (the comb notches fall at different positions),
// and bow noise that appears in sync with each slip of the bow on the string; all of that is summed and then passed through a body of a hundred-odd modes.
// Measured against the University of Iowa violin, cello and double bass recordings (sustained notes on every string), three things were still off:
//   - the body's actual response did not follow its envelope: below the air resonance and above the bridge hill the modes' skirts piled up, so the
//     open G of a violin had a fundamental as strong as its second partial (real: ~20 dB weaker) and the double bass was 10-20 dB too bright; and
//     above 1 kHz the modes were too few and too broad for the vibrato to make the partials flicker (2-3 dB, real violins 5-15 dB) (bodyModes);
//   - a corner fixed in hertz left the low strings as bright as the high ones (bowTable);
//   - between the partials the noise floor was 6-14 dB cleaner than the recordings (bow noise raised, and rounded off with the tone).
//
// The sample has two parts: the attack (the bow grips the string, the vibrato comes in and grows) and a sustain section that can loop seamlessly.
// All the modulation in the sustain section (vibrato, intonation drift, bow-pressure swell, bow noise) has the loop length as its period,
// and each player's frequency is also fine-tuned so that it covers a whole number of periods within the loop length, so there is no seam at the loop point.
//
// Pitch-tracked on held notes, the vibrato was there but easy to miss: it began 0.3 s into a note and reached full depth only at 0.5 s, so eighth
// notes had none and quarter notes were half straight; it was a little narrow (violin ±20 cents, cello ±15, each double bass ±8) and every cycle
// was the same; and rounding its speed to whole cycles in a 1.5 s loop put a violin at 5.3 or 6.0 Hz depending on the note, and a section's seven
// players on just two speeds. Now it starts 0.1 s after the bow (audible from about 0.2 s), is most of the way in two cycles later and keeps
// deepening a little until 0.8 s, so a held note blooms; a solo's loop is cut to fit its vibrato and a section's is long enough for its players
// to spread over three speeds; and speed and depth wander a little from cycle to cycle, as a hand's do.

import { rng } from './dsp/core.ts';

/** Body: a spectral envelope ([Hz, dB] polyline, the average radiated response) plus narrow modes scattered according to it */
export interface BodyDef {
  seed: number;
  env: [number, number][];
  /** The lowest mode (the air resonance A0 sits just above it: nothing radiates below) and the highest */
  lo: number;
  hi: number;
  /** Modes per octave at lo; the count grows with frequency */
  density: number;
  /** Q of the modes: low end, high end */
  q: [number, number];
  /** How far each mode jumps above and below the envelope (dB): the larger it is, the more uneven the body */
  rand: number;
}

export interface BowDef {
  /** Number of players: 1 is a solo */
  players: number;
  /** Fixed intonation offset between players (cents, standard deviation) */
  spread: number;
  /** Intonation that each player slowly drifts (cents) */
  drift: number;
  /** Vibrato speed (Hz): each note, and each player in a section, varies around it */
  vibRate: number;
  /** Vibrato depth once it has grown in (cents, up and down from the note) */
  vibDepth: number;
  /** How long after the bow starts the vibrato begins (seconds) */
  vibDelay: number;
  /** Range of the bowing point (fraction of the string length): each player sits somewhere in it */
  beta: [number, number];
  /** Bow force: the partial number where the rounded Helmholtz corner has cut the partials by 6 dB, [soft, hard] */
  corner: [number, number];
  /** Sustained bow noise (relative to the string tone) */
  noise: number;
  /** Attack scrape sound */
  scrape: number;
  /** Attack time (seconds), [soft, hard] */
  attack: [number, number];
  /** Time offset at which players come in (seconds) */
  onset: number;
  /** How many cents below the note the attack slides up from */
  scoop: number;
  body: BodyDef;
  /** Loop section length (seconds); a solo's is adjusted to hold a whole number of its vibrato cycles */
  loop: number;
}

export interface Bowed {
  /** The sample; it runs on a little past the loop's end, with the loop's start repeated (see GUARD) */
  data: Float32Array;
  /** Loop section: [start, end] (samples) */
  loop: [number, number];
}

/** Attack section length (seconds): the attack and the vibrato's growth must both finish before it ends, and the body's resonances must have settled */
const PRE = 0.8;
/** The vibrato grows in over this long after it begins (about two cycles), to 85% of its depth; the rest it gains slowly up to the end of the attack section, so a held note blooms */
const VIB_GROW = 0.3;
const TABLE = 2048;
/** Samples after the loop's end that repeat its start */
const GUARD = 64;
/** Modulation (frequency, volume) is computed once every few samples, with linear interpolation in between */
const CR = 16;

/** Polyline envelope (linear interpolation on a log frequency axis), returns dB */
function envAt(env: [number, number][], f: number): number {
  if (f <= env[0][0]) return env[0][1];
  for (let i = 1; i < env.length; i++) {
    if (f <= env[i][0]) {
      const [f0, d0] = env[i - 1];
      const [f1, d1] = env[i];
      return d0 + ((d1 - d0) * Math.log(f / f0)) / Math.log(f1 / f0);
    }
  }
  return env[env.length - 1][1];
}

/**
 * One period of the bowed string: a sawtooth with the partials at integer multiples of the bowing point cut out, then rounded off; partials are only added up to maxF.
 * The rounding of the Helmholtz corner (Cremer): every period the string's internal losses (a roughly constant loss factor in the gut or
 * synthetic core and the windings, so partial k loses in proportion to k per period) smooth the corner, and every pass under the bow sharpens it again,
 * the more so the harder the bow presses. In balance partial k is cut by 1 / (1 + (k / kc)²): the cut sits at a partial number, not a frequency,
 * so low notes are darker at the same frequency: in the recordings a note on the lowest string has 7 dB (violin) and 16 dB (cello) less of its
 * energy at 4-8 kHz than one on the highest; a corner fixed in hertz gave 2 and 5 dB.
 */
function bowTable(f: number, beta: number, kc: number, maxF: number): Float32Array {
  const t = new Float32Array(TABLE);
  const K = Math.max(1, Math.min(400, Math.floor(maxF / f)));
  for (let k = 1; k <= K; k++) {
    const a = (0.1 + Math.abs(Math.sin(Math.PI * k * beta))) / k / (1 + (k / kc) ** 2);
    // Compute sin(2πkn/N) with a rotation recurrence, much faster than calling Math.sin at every point
    const th = (2 * Math.PI * k) / TABLE;
    const c = Math.cos(th);
    const s = Math.sin(th);
    let x = 0;
    let y = 1;
    for (let n = 0; n < TABLE; n++) {
      t[n] += a * x;
      const nx = x * c + y * s;
      y = y * c - x * s;
      x = nx;
    }
  }
  let mx = 0;
  for (let n = 0; n < TABLE; n++) mx = Math.max(mx, Math.abs(t[n]));
  for (let n = 0; n < TABLE; n++) t[n] /= mx;
  return t;
}

/** A band-pass mode y = b·(x[n] - x[n-2]) - a1·y[n-1] - a2·y[n-2] (its gain folded into b) */
interface Mode {
  b: number;
  a1: number;
  a2: number;
}

/** Modes per octave stop growing here: neighbouring modes already overlap */
const MAX_DENSITY = 30;

/**
 * Scatter modes according to the envelope (band-pass); each seed is a different instrument.
 * - A plate has roughly a constant number of modes per hertz, so per octave the count grows with frequency: a few isolated modes in the
 *   low register (A0, B1-, B1+), a thicket above 1-2 kHz. There a ±20-cent vibrato sweeps each partial across peaks and dips and its level
 *   flickers by 5-10 dB, as measured on real violins; with a sparse, broad body the partials sound static.
 * - Each mode reaches the listener with its own sign (radiation is a transfer function, not the bridge's driving-point admittance), so far
 *   from their peaks the skirts cancel instead of piling up: the response falls away below the lowest mode, where the air in the f-holes and
 *   the plates' volume change are in antiphase (an open G on a violin, 196 Hz below A0, radiates its fundamental ~20 dB under the second
 *   partial), and above the bridge hill.
 * - A mode's peak is scaled so its power, spread over the gap to the next mode, matches the envelope: the envelope is the average response.
 */
function bodyModes(sr: number, b: BodyDef): Mode[] {
  const r = rng(b.seed);
  const out: Mode[] = [];
  const l0 = Math.log2(b.lo);
  const oct = Math.log2(b.hi) - l0;
  const top = Math.log2(Math.min(b.hi, sr * 0.45));
  for (let x = l0; ; ) {
    const n = Math.min(MAX_DENSITY, b.density * Math.pow(2, (x - l0) * 0.6));
    x += (1 + 0.8 * r()) / n;
    if (x >= top) break;
    const f = Math.pow(2, x);
    const q = b.q[0] + ((b.q[1] - b.q[0]) * (x - l0)) / oct;
    const db = envAt(b.env, f) + r() * b.rand;
    const g = (r() < 0 ? -1 : 1) * Math.pow(10, db / 20) * Math.sqrt((2 * q * Math.LN2) / (Math.PI * n));
    const w = (2 * Math.PI * f) / sr;
    const al = Math.sin(w) / (2 * q);
    const a0 = 1 + al;
    out.push({ b: (g * al) / a0, a1: (-2 * Math.cos(w)) / a0, a2: (1 - al) / a0 });
  }
  return out;
}

/** Smooth 0 -> 1 */
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/**
 * Compute one bowed-string sample. f is the pitch (Hz), loud decides bow pressure (brightness, bow noise, attack), and seed makes the players different for every note.
 * The returned sample can loop seamlessly across the loop interval.
 */
export function bowSample(sr: number, f: number, d: BowDef, loud: boolean, seed: number): Bowed {
  const r = rng(seed * 7919 + Math.round(f * 13));
  const P = d.players;
  const solo = P === 1;
  // Vibrato speed: a lighter bow goes with a slightly slower and narrower vibrato. A solo varies a little from note to note and its loop is cut
  // to a whole number of its cycles; in a section each player has their own speed, rounded to whole cycles in the loop
  const pace = loud ? 1 : 0.96;
  const soloRate = d.vibRate * pace * (1 + 0.04 * r());
  const loop = solo ? Math.max(1, Math.round(soloRate * d.loop)) / soloRate : d.loop;
  // The attack section and the loop section are both integer multiples of CR, so the modulation's sample grid lines up at the loop's head and tail
  const LS = Math.round((loop * sr) / CR) * CR;
  const L = LS / sr;
  const A = Math.round((PRE * sr) / CR) * CR;
  const N = A + LS;
  const sum = new Float32Array(N);
  const corner = loud ? d.corner[1] : d.corner[0];
  const atk = loud ? d.attack[1] : d.attack[0];
  const maxF = sr * 0.4;

  // All players share one stretch of bow noise whose period is the loop length (each reads from a different position): high-pass then low-pass, running two passes so the filter state joins up head to tail.
  // The noise rides on the slip, so the string rounds it off like the tone: two low-pass poles at the corner (kc partials, 2-6 kHz).
  // Left flat to 6 kHz, the hiss was all a low cello note had above 4 kHz (12 dB more than a real C string); some hiss comes from the hair itself, so not below 2 kHz.
  const nz = new Float32Array(LS);
  {
    const raw = new Float32Array(LS);
    for (let i = 0; i < LS; i++) raw[i] = r();
    let lp = 0;
    let lp2 = 0;
    let hp = 0;
    const al = 1 - Math.exp((-2 * Math.PI * Math.min(6000, Math.max(2000, corner * f))) / sr);
    const ah = 1 - Math.exp((-2 * Math.PI * 700) / sr);
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < LS; i++) {
        lp += al * (raw[i] - lp);
        lp2 += al * (lp - lp2);
        hp += ah * (lp2 - hp);
        if (pass) nz[i] = lp2 - hp;
      }
    }
  }

  const tables = new Map<number, Float32Array>();
  const T = (beta: number) => {
    const k = Math.round(beta * 200);
    let t = tables.get(k);
    if (!t) tables.set(k, (t = bowTable(f, k / 200, corner, maxF)));
    return t;
  };

  for (let p = 0; p < P; p++) {
    const beta = d.beta[0] + (d.beta[1] - d.beta[0]) * (solo ? 0.5 : (r() + 1) / 2);
    const tab = T(beta);
    // Vibrato: every player has a different speed, depth, phase and onset; the speed is a whole number of cycles within the loop length
    const vr = Math.max(1, Math.round((solo ? soloRate : d.vibRate * pace * (1 + r() * 0.09)) * L)) / L;
    const vd = d.vibDepth * (loud ? 1 : 0.9) * (solo ? 1 + r() * 0.08 : 0.9 + r() * 0.3);
    const vph = (r() + 1) * Math.PI;
    const von = d.vibDelay * (solo ? 1 : 0.7 + 0.6 * Math.abs(r()));
    // No two cycles alike: the speed wanders by a few percent and the depth by about a tenth, along four slow sinusoids whose period is the loop length.
    // Each is [Hz, phase swing, depth swing, the two phases]; a phase swing of a·sin(2π·hz·t) moves the speed by up to a·hz / vr of itself (here 5%)
    const wob: [number, number, number, number, number][] = [1, 2, 3, 4].map((k) => [k / L, (0.05 * r() * vr) / (k / L), 0.12 * r(), (r() + 1) * Math.PI, (r() + 1) * Math.PI]);
    // Intonation drift: three slow sinusoids whose period is the loop length
    const dr: [number, number, number][] = [1, 2, 3].map((k) => [k / L, d.drift * r() * 0.6, (r() + 1) * Math.PI]);
    // Bow-pressure swell: a very slow volume change (±5%)
    const bw: [number, number] = [(1 + Math.round((r() + 1) * 1.5)) / L, (r() + 1) * Math.PI];
    const det = solo ? 0 : d.spread * r() * 1.2;
    const on = solo ? 0 : ((r() + 1) / 2) * d.onset;
    const scoop = d.scoop * (0.6 + 0.4 * Math.abs(r()));
    const cents = (t: number, v: number) => {
      let ph = 2 * Math.PI * vr * t + vph;
      let g = 1;
      for (const [hz, a, b, p1, p2] of wob) {
        ph += a * Math.sin(2 * Math.PI * hz * t + p1);
        g += b * Math.sin(2 * Math.PI * hz * t + p2);
      }
      let c = vd * v * g * (Math.sin(ph) + 0.12 * Math.sin(2 * ph));
      for (const [hz, a, p2] of dr) c += a * Math.sin(2 * Math.PI * hz * t + p2);
      return c;
    };
    // Frequency fine-tuning: the sustain section's mean frequency times the loop length must come out to exactly a whole number of periods
    let m = 0;
    const S = 2048;
    for (let i = 0; i < S; i++) m += Math.pow(2, cents(PRE + (i / S) * L, 1) / 1200);
    m /= S;
    const target = f * Math.pow(2, det / 1200);
    const F = Math.max(1, Math.round(target * m * L)) / (m * L);

    const nOff = Math.floor(((r() + 1) / 2) * LS);
    const nAmt = d.noise * (loud ? 1.35 : 1) * (solo ? 1 : 0.8 + 0.4 * Math.abs(r()));
    const slip = beta;
    const amp = solo ? 1 : 1 / Math.sqrt(P);
    // Control rate: once every CR samples compute the frequency (the phase increment per sample) and the volume
    const nc = N / CR + 2;
    const inc = new Float64Array(nc);
    const env = new Float64Array(nc);
    for (let c = 0; c < nc; c++) {
      const t = (c * CR) / sr;
      const ta = t - on;
      if (ta < 0) continue;
      const v = 0.75 * smooth((t - von) / VIB_GROW) + 0.25 * smooth((t - von) / (PRE - von));
      const sc = -scoop * Math.exp(-ta / 0.045);
      inc[c] = (F * Math.pow(2, (cents(t, v) + sc) / 1200)) / sr;
      // Attack: the bow grips the string (a hard bow overshoots a little and then comes back); after that comes a very slow bow-pressure swell
      let e = smooth(ta / atk);
      if (loud) e *= 1 + 0.22 * e * Math.exp(-Math.max(0, ta - atk) / 0.08);
      env[c] = amp * e * (1 + 0.05 * Math.sin(2 * Math.PI * bw[0] * t + bw[1]));
    }
    let ph = (r() + 1) / 2;
    const i0 = Math.floor((on * sr) / CR) * CR;
    for (let i = i0; i < N; i++) {
      const c = (i / CR) | 0;
      const u = (i - c * CR) / CR;
      ph += inc[c] + (inc[c + 1] - inc[c]) * u;
      if (ph >= 1) ph -= 1;
      const x = ph * TABLE;
      const j = x | 0;
      const fr = x - j;
      const s0 = tab[j];
      const tone = s0 + (tab[(j + 1) & (TABLE - 1)] - s0) * fr;
      // Bow noise appears along with the slip of the bow on the string (the short stretch at the start of each period)
      const nzv = nz[(i + nOff) % LS] * (ph < slip ? 1 : 0.3) * nAmt;
      sum[i] += (env[c] + (env[c + 1] - env[c]) * u) * (tone + nzv);
    }
  }

  // The highs come in a little later on the attack: a one-pole low-pass from dark to fully open (the sustain section passes straight through)
  {
    let y = 0;
    const end = Math.floor((atk * 1.6 + 0.05) * sr);
    for (let i = 0; i < N; i++) {
      if (i >= end) {
        y = sum[i];
        continue;
      }
      const u = smooth(i / end);
      const fc = f * 3 + (sr * 0.45 - f * 3) * u * u;
      const a = 1 - Math.exp((-2 * Math.PI * fc) / sr);
      y += a * (sum[i] - y);
      sum[i] = y;
    }
  }

  // The attack's scrape (non-periodic, finishing within the attack section)
  if (d.scrape > 0) {
    const sc = d.scrape * (loud ? 1.4 : 0.7);
    let lp = 0;
    let hp = 0;
    const al = 1 - Math.exp((-2 * Math.PI * 5000) / sr);
    const ah = 1 - Math.exp((-2 * Math.PI * 900) / sr);
    const len = Math.min(A - 1, Math.floor((atk + 0.12) * sr));
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      lp += al * (r() - lp);
      hp += ah * (lp - hp);
      sum[i] += (lp - hp) * sc * smooth(t / 0.006) * Math.exp(-t / (atk * 0.6 + 0.03));
    }
  }

  // Body: a bank of narrow modes in parallel. They all take the same input difference x[n] - x[n-2], and run two at a time
  const modes = bodyModes(sr, d.body);
  const dx = new Float32Array(N);
  for (let i = 0; i < N; i++) dx[i] = sum[i] - (i >= 2 ? sum[i - 2] : 0);
  const out = new Float32Array(N);
  const none: Mode = { b: 0, a1: 0, a2: 0 };
  for (let m = 0; m < modes.length; m += 2) {
    const { b: pb, a1: pa1, a2: pa2 } = modes[m];
    const { b: qb, a1: qa1, a2: qa2 } = modes[m + 1] ?? none;
    let p1 = 0;
    let p2 = 0;
    let q1 = 0;
    let q2 = 0;
    for (let i = 0; i < N; i++) {
      const x = dx[i];
      const p = pb * x - pa1 * p1 - pa2 * p2;
      const q = qb * x - qa1 * q1 - qa2 * q2;
      p2 = p1;
      p1 = p;
      q2 = q1;
      q1 = q;
      out[i] += p + q;
    }
  }

  // Loop seam: the lowest body modes ring for a few hundred milliseconds, so at the loop start they still carry a trace of the attack (up to -31 dB
  // for a low bass note). Crossfade the last 60 ms of the loop into the 60 ms that lead into it, so the jump back to the loop start is seamless.
  {
    const X = Math.min(Math.round(sr * 0.06), A);
    for (let j = 0; j < X; j++) {
      const w = (j + 0.5) / X;
      out[N - X + j] += w * (out[A - X + j] - out[N - X + j]);
    }
  }

  // Set the volume by the sustain section's RMS (every pitch equally loud, the soft and hard layers equally loud too; loudness is left to velocity)
  let e2 = 0;
  for (let i = A; i < N; i++) e2 += out[i] * out[i];
  const k = 0.2 / Math.sqrt(e2 / LS + 1e-12);
  for (let i = 0; i < N; i++) out[i] *= k;
  // The buffer runs on past the loop's end with a copy of the loop's start. Chrome's looping source does not interpolate across the jump back
  // when the loop ends at the very end of the buffer (a test sine clicked on every pass unless its loop began at a zero crossing), and low notes
  // ticked once a loop; now the samples either side of the loop's end are the ones the loop plays.
  const data = new Float32Array(N + GUARD);
  data.set(out);
  data.set(out.subarray(A, A + GUARD), N);
  return { data, loop: [A, N] };
}

// ───────────────────────── Instruments ─────────────────────────

/** How a bowed instrument is sampled and played */
export interface BowInst {
  def: BowDef;
  /** One sample every how many semitones; the notes in between are made up with a rate change */
  zone: number;
  /** What fraction of the device sample rate to compute at (strings have almost nothing above 12 kHz, and bass instruments even less; saves memory and time) */
  rate: number;
  /** Attack and release at playback (seconds); a song's params.attack / release can override them */
  attack: number;
  release: number;
  /** Velocity (times params.bright) above this value uses the hard-bow layer */
  loudAt: number;
  /** Glide time constant (seconds) */
  glide: number;
  level: number;
  /** Share another instrument's samples (the same group of players, only played differently) */
  share?: string;
}

// Body envelope: [Hz, dB], the average radiated response. Fitted, with the bow corner, to the sustained mf notes of the University of Iowa
// violin, cello and double bass recordings (1/3-octave partial levels across every string). The violin: air resonance A0 at 280 Hz, the corpus
// modes B1- and B1+ at 450-550 Hz, a dip around 700 Hz, the bridge hill at 2-4 kHz and a steep fall above 4-5 kHz. The cello sits an octave
// and a half lower; the double bass radiates mostly 50-200 Hz and is dark above. Bodies without recordings keep the shape the old model actually produced.
const VIOLIN_BODY: BodyDef = { seed: 11, lo: 200, hi: 9000, density: 9, q: [36, 70], rand: 7, env: [[200, -12], [280, -1], [480, 2], [560, 0], [720, -5], [1000, -1], [1400, -2], [1900, 3], [2400, 0], [3000, 5], [3800, 8], [5000, -1], [7000, -9], [9000, -16]] };
/** String section: the averaged body of violins and violas, flatter */
const SECTION_BODY: BodyDef = { seed: 41, lo: 160, hi: 8000, density: 6, q: [28, 36], rand: 5, env: [[150, -14], [240, 0], [350, 0], [500, 3], [700, -4], [1000, -2], [1400, 1], [2000, 3], [2600, 4], [3500, 0], [5000, -4], [8000, -16]] };
const CELLO_BODY: BodyDef = { seed: 23, lo: 80, hi: 9000, density: 9, q: [34, 70], rand: 7, env: [[70, -19], [100, -4], [150, 1], [220, -3], [350, 2], [500, 0], [700, -4], [1000, -1], [1800, 7], [2500, 7], [4000, -7], [6000, -7], [9000, -16]] };
const BASS_BODY: BodyDef = { seed: 31, lo: 36, hi: 6000, density: 7, q: [26, 48], rand: 5, env: [[36, -12], [45, -11], [60, -2], [100, 5], [150, 6], [200, -3], [300, -4], [500, -10], [1000, -11], [1600, -6], [2500, -9], [4000, -9], [6000, -11]] };
const FIDDLE_BODY: BodyDef = { seed: 53, lo: 220, hi: 10000, density: 9, q: [36, 70], rand: 7, env: [[220, -12], [300, 3], [520, 4], [800, 0], [1100, -1], [1500, -2], [2200, 1], [3000, 4], [4000, 5], [6000, -3], [10000, -16]] };
/** Morin khuur (horsehead fiddle): a skin-covered square body, a 900 Hz nasal tone, few highs */
const MORIN_BODY: BodyDef = { seed: 67, lo: 150, hi: 7000, density: 7, q: [26, 40], rand: 6, env: [[150, -12], [240, 1], [400, -2], [900, 6], [1300, 0], [1700, -3], [2400, 0], [3500, -5], [5000, -9], [7000, -16]] };

const section = (body: BodyDef, players: number): BowDef => ({
  players,
  spread: 9,
  drift: 6,
  vibRate: 5.8,
  vibDepth: 22,
  vibDelay: 0.12,
  beta: [0.07, 0.16],
  corner: [7, 14],
  noise: 0.1,
  scrape: 0.6,
  attack: [0.12, 0.06],
  onset: 0.04,
  scoop: 12,
  body,
  loop: 2,
});

const solo = (body: BodyDef, vibRate: number, vibDepth: number, beta: number, corner: [number, number], noise: number): BowDef => ({
  players: 1,
  spread: 0,
  drift: 3,
  vibRate,
  vibDepth,
  vibDelay: 0.1,
  beta: [beta, beta],
  corner,
  noise,
  scrape: 0.5,
  attack: [0.08, 0.045],
  onset: 0,
  scoop: 14,
  body,
  loop: 2,
});

export const BOWS = {
  /** String section: seven players */
  strings: { def: section(SECTION_BODY, 7), zone: 3, rate: 0.75, attack: 0.02, release: 0.4, loudAt: 0.72, glide: 0.09, level: 0.89 },
  /** The slow version of the string section (soft, long): the same samples */
  strPad: { def: section(SECTION_BODY, 7), zone: 3, rate: 0.75, attack: 0.6, release: 0.9, loudAt: 2, glide: 0.09, level: 0.81, share: 'strings' },
  violin: { def: solo(VIOLIN_BODY, 6.2, 27, 0.113, [8, 16], 0.1), zone: 3, rate: 0.75, attack: 0.02, release: 0.25, loudAt: 0.72, glide: 0.09, level: 0.57 },
  cello: { def: solo(CELLO_BODY, 5.6, 24, 0.12, [8, 16], 0.2), zone: 3, rate: 0.5, attack: 0.02, release: 0.3, loudAt: 0.72, glide: 0.09, level: 0.66 },
  /** Folk fiddle: brighter, with a faster, narrower vibrato that comes in later */
  fiddle: { def: { ...solo(FIDDLE_BODY, 6.2, 12, 0.09, [11, 22], 0.12), vibDelay: 0.18 }, zone: 3, rate: 0.75, attack: 0.015, release: 0.2, loudAt: 0.72, glide: 0.07, level: 0.6 },
  /** Morin khuur: horsehair bow, lots of breath noise, wide slow vibrato that comes in later */
  morin: { def: { ...solo(MORIN_BODY, 4.4, 26, 0.15, [6, 11], 0.14), vibDelay: 0.18 }, zone: 3, rate: 0.75, attack: 0.03, release: 0.3, loudAt: 0.72, glide: 0.14, level: 0.81 },
  /** Cello section: five players, for sustained notes and harmony in the low-mid register (use cello for solos) */
  celli: { def: { ...section(CELLO_BODY, 5), vibRate: 5.5, vibDepth: 20, corner: [7, 14], noise: 0.15 }, zone: 3, rate: 0.5, attack: 0.03, release: 0.4, loudAt: 0.72, glide: 0.1, level: 0.66 },
  /** Double bass section: three players, with a slower vibrato */
  contrabass: { def: { ...section(BASS_BODY, 3), vibRate: 5, vibDepth: 14, corner: [8, 16], spread: 4 }, zone: 3, rate: 0.5, attack: 0.03, release: 0.35, loudAt: 0.72, glide: 0.1, level: 0.61 },
} satisfies Record<string, BowInst>;
