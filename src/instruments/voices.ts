// Live-synthesized sustained instruments: flutes, reeds, saxophones, brass, choir, organ, accordion, throat singing (khoomei), chord pad, bass, distorted guitar, ambience.
// Each note builds a small graph of Web Audio nodes; sampled instruments (plucked strings, bells, drums) are rendered offline in dsp/ instead.

import { rng } from './dsp/core.ts';

export interface VoiceCall {
  ctx: BaseAudioContext;
  out: AudioNode;
  t: number;
  /** Note length (seconds) */
  dur: number;
  f: number;
  vel: number;
  /** Glide: [seconds from the start, target frequency] */
  bends?: [number, number][];
  /** Instrument parameters (a song's track.params can override them) */
  o: Readonly<Record<string, number>>;
}

export type Voice = (c: VoiceCall) => void;

// ───────────────────────── Shared parts ─────────────────────────

const waves = new WeakMap<BaseAudioContext, Map<string, PeriodicWave>>();
/** A periodic wave from a custom harmonic table (organ, accordion) */
function wave(ctx: BaseAudioContext, key: string, amps: number[]): PeriodicWave {
  let m = waves.get(ctx);
  if (!m) waves.set(ctx, (m = new Map()));
  let w = m.get(key);
  if (!w) {
    const real = new Float32Array(amps.length + 1);
    const imag = new Float32Array(amps.length + 1);
    amps.forEach((a, i) => (imag[i + 1] = a));
    w = ctx.createPeriodicWave(real, imag);
    m.set(key, w);
  }
  return w;
}

/**
 * Baked waveform: compute the formant / body response straight into the amplitude of each harmonic, saving a filter (much cheaper on CPU).
 * amp(k, f) returns the amplitude of the k-th harmonic (at frequency f); cached once per pitch.
 */
function baked(ctx: BaseAudioContext, key: string, f0: number, amp: (k: number, f: number) => number, maxF = 9000): PeriodicWave {
  const semi = Math.round(12 * Math.log2(f0 / 440));
  const k = `${key}@${semi}`;
  let m = waves.get(ctx);
  if (!m) waves.set(ctx, (m = new Map()));
  let w = m.get(k);
  if (!w) {
    const fr = 440 * Math.pow(2, semi / 12);
    const n = Math.max(1, Math.min(96, Math.floor(maxF / fr)));
    const real = new Float32Array(n + 1);
    const imag = new Float32Array(n + 1);
    for (let i = 1; i <= n; i++) imag[i] = amp(i, i * fr);
    w = ctx.createPeriodicWave(real, imag);
    m.set(k, w);
  }
  return w;
}

/** Formant (Lorentzian peak): [center, bandwidth, gain] */
const peaks = (f: number, fs: [number, number, number][]): number => {
  let a = 0;
  for (const [F, bw, g] of fs) a += g / (1 + ((f - F) / (bw / 2)) ** 2);
  return a;
};

const noiseBufs = new WeakMap<BaseAudioContext, AudioBuffer>();
function noise(ctx: BaseAudioContext): AudioBuffer {
  let b = noiseBufs.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const d = b.getChannelData(0);
    const r = rng(99);
    for (let i = 0; i < d.length; i++) d[i] = r();
    noiseBufs.set(ctx, b);
  }
  return b;
}

function noiseSrc(ctx: BaseAudioContext, t: number, end: number): AudioBufferSourceNode {
  const s = ctx.createBufferSource();
  s.buffer = noise(ctx);
  s.loop = true;
  s.start(t, Math.random() * 2);
  s.stop(end);
  return s;
}

const breathBufs = new WeakMap<BaseAudioContext, AudioBuffer>();
/** Pre-filtered breath noise (a wide band-pass at 1.5-5 kHz), shared by the wind instruments, saving a filter on every note */
function breathSrc(ctx: BaseAudioContext, t: number, end: number): AudioBufferSourceNode {
  let b = breathBufs.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    const r = rng(77);
    let lp = 0;
    let hp = 0;
    for (let i = 0; i < d.length; i++) {
      const x = r();
      lp += 0.45 * (x - lp);
      hp += 0.08 * (lp - hp);
      d[i] = (lp - hp) * 2.2;
    }
    breathBufs.set(ctx, b);
  }
  const s = ctx.createBufferSource();
  s.buffer = b;
  s.loop = true;
  s.start(t, Math.random() * 1.8);
  s.stop(end);
  return s;
}

function osc(ctx: BaseAudioContext, type: OscillatorType | PeriodicWave, f: number, t: number, end: number, detune = 0): OscillatorNode {
  const o = ctx.createOscillator();
  if (typeof type === 'string') o.type = type as OscillatorType;
  else o.setPeriodicWave(type);
  o.frequency.setValueAtTime(f, t);
  if (detune) o.detune.setValueAtTime(detune, t);
  o.start(t);
  o.stop(end);
  return o;
}

function filt(ctx: BaseAudioContext, type: BiquadFilterType, f: number, q = 0.7, gain = 0): BiquadFilterNode {
  const b = ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  if (gain) b.gain.value = gain;
  return b;
}

function gainNode(ctx: BaseAudioContext, v = 1): GainNode {
  const g = ctx.createGain();
  g.gain.value = v;
  return g;
}

/**
 * ADSR: attack, decay to the sustain ratio, release starting at t+dur. All use explicit ramps (different implementations compute the same result). Returns the time the sound actually ends.
 * The release falls exponentially to floor (a level, not a ratio: a louder peak falls faster in dB); a voice whose gain is normalized per note passes peak·1e-3 to keep its release independent of that.
 */
function adsr(g: GainNode, t: number, dur: number, peak: number, a: number, d: number, s: number, r: number, floor = 1e-4): number {
  const p = g.gain;
  const aa = Math.min(a, Math.max(0.003, dur * 0.9));
  const rel = t + Math.max(dur, aa + 0.005);
  const sus = Math.max(floor, peak * s);
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + aa);
  const dEnd = t + aa + Math.max(0.001, d);
  let lv = peak;
  if (d > 0 && s < 1) {
    if (rel > dEnd) {
      p.exponentialRampToValueAtTime(sus, dEnd);
      lv = sus;
    } else {
      lv = peak * Math.pow(sus / peak, (rel - t - aa) / (dEnd - t - aa));
      p.exponentialRampToValueAtTime(Math.max(floor, lv), rel);
    }
  }
  p.setValueAtTime(Math.max(floor, lv), rel);
  p.exponentialRampToValueAtTime(floor, rel + r);
  p.setValueAtTime(0, rel + r + 0.005);
  return rel + r + 0.02;
}

/** Smoothly fade to 0 (the target of setTargetAtTime cannot be 0: some implementations diverge) */
function fadeTo0(p: AudioParam, t: number, tau: number): void {
  p.setTargetAtTime(1e-4, t, tau);
  p.setValueAtTime(0, t + tau * 9);
}

/** Apply glides to a frequency parameter */
function applyBends(p: AudioParam, c: VoiceCall, ratio = 1, glide = 0.07): void {
  if (!c.bends) return;
  for (const [at, f] of c.bends) p.setTargetAtTime(f * ratio, c.t + at, glide / 3);
}

/** Delayed vibrato: after delay seconds, wobble at depth cents and rate Hz */
function vibrato(ctx: BaseAudioContext, targets: AudioParam[], t: number, end: number, rate: number, cents: number, delay: number): void {
  if (cents <= 0) return;
  const lfo = osc(ctx, 'sine', rate * (0.96 + Math.random() * 0.08), t, end);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0, t + delay * 0.5);
  g.gain.linearRampToValueAtTime(cents, t + delay + 0.3);
  lfo.connect(g);
  for (const p of targets) g.connect(p);
}

function panned(ctx: BaseAudioContext, dest: AudioNode, pan: number): AudioNode {
  if (!pan || !ctx.createStereoPanner) return dest;
  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  p.connect(dest);
  return p;
}

// ───────────────────────── Lip and reed valves ─────────────────────────
//
// A brass player's lips and a saxophone's reed are valves that let the air into the instrument in puffs, once per cycle. Blown softly the valve
// barely closes and the flow is nearly a sine; blown hard it slams shut, the puffs grow short and sharp, and (in brass) nonlinear steepening along
// the bore adds more: the spectrum fills with harmonics. Below forte the n-th harmonic rises about n dB for every dB of the fundamental (Benade),
// so a crescendo opens up the tone, and the upper harmonics of a forte note sit 20-40 dB higher, relative to the fundamental, than in a piano note.
// The valve is a sine through the waveshaper x / (1 - Cx): for a sine of amplitude a the n-th harmonic falls as rⁿ, with r = (1 - √(1 - a²)) / a,
// about a/2 when soft and close to 1 when loud (Beauchamp's nonlinear brass synthesis). The drive is set per note so the harmonics fall as e^(-f/F)
// in hertz, with F growing with velocity. The envelope drives the waveshaper too: the harmonics come in one after another as the attack rises
// (Risset's trumpet analysis), with a brief bright blip, and the tone darkens as it dies away.
// An air jet blown across an edge (the flutes) is a nonlinear drive of the same kind: Fletcher measured that from piano to forte a flute's fundamental
// grows about 10 dB while its second and third harmonics grow 20-30 dB. Because the harmonics fall off in hertz, a low note is rich and a high one
// nearly a sine. The curve's odd and even parts can be weighted apart: x(1 + eCx) / (1 - C²x²) gives odd harmonics rⁿ and even ones e·rⁿ
// (e = 1 is x / (1 - Cx)), for a bore that favours the odd ones.

const VALVE_C = 0.99995;
/** Highest a used (the harmonics then fall 0.3 dB each, enough for a forte pedal note), and the drive that gives it */
const VALVE_A = 0.9995;
const VALVE_MAX = VALVE_A / VALVE_C;
/** The even harmonics' share, in the steps the curves are cached at */
const evenStep = (e: number): number => Math.round(Math.min(1, Math.max(0, e)) * 20) / 20;
const valveTables = new Map<number, Float32Array<ArrayBuffer>>();
/** The valve's waveshaper curve x(1 + eCx) / (1 - C²x²), e being the even harmonics' share */
function valveCurve(even: number): Float32Array<ArrayBuffer> {
  const e = evenStep(even);
  let c = valveTables.get(e);
  if (!c) {
    // Fine enough to draw the sharp puffs of a loud low note
    const n = 32768;
    c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      c[i] = (x * (1 + e * VALVE_C * x)) / (1 - VALVE_C * VALVE_C * x * x);
    }
    valveTables.set(e, c);
  }
  return c;
}

/** Valve drive (input amplitude) for harmonics falling as e^(-f/F) */
function valveDrive(f0: number, F: number): number {
  const r = Math.exp(-f0 / Math.max(1, F));
  return Math.min(VALVE_A, (2 * r) / (1 + r * r)) / VALVE_C;
}

/** Predicted RMS of the valve's output at drive A after a band-pass with first-order corners lo and hi (Hz) and an optional eq(f) gain, for level matching */
function valveRms(sr: number, f0: number, A: number, lo: number, hi: number, even = 1, eq?: (f: number) => number): number {
  const a = A * VALVE_C;
  const r = (1 - Math.sqrt(1 - a * a)) / a;
  let p = 0;
  let rn = 1;
  for (let n = 1; n * f0 < sr * 0.45 && rn > 1e-4; n++) {
    rn *= r;
    const w = n * f0;
    const h = (((lo + hi) * w) / Math.sqrt((w * w + lo * lo) * (w * w + hi * hi))) * (n % 2 ? 1 : evenStep(even)) * (eq ? eq(w) : 1);
    p += rn * rn * h * h;
  }
  return Math.sqrt(p * 2) / (VALVE_C * Math.sqrt(1 - a * a)) || 1;
}

/** A first-order high-pass at lo times a first-order low-pass at hi, as one band-pass biquad (Q below 0.5: two real poles) */
function bandOf(ctx: BaseAudioContext, lo: number, hi: number): BiquadFilterNode {
  return filt(ctx, 'bandpass', Math.sqrt(lo * hi), Math.sqrt(lo * hi) / (lo + hi));
}

interface ValveNote {
  f: number;
  t0: number;
  end: number;
  /** Fall-off of the harmonics (Hz) once the note settles */
  F: number;
  att: number;
  /** When the release starts, and its length */
  off: number;
  rel: number;
  /** Fall-off at the start of the attack and at its end, relative to F (default 0.3 and 1.1) */
  start?: number;
  blip?: number;
  /** Room kept below the curve's pole for a modulation of the drive */
  headroom?: number;
  /** Share of the even harmonics (default 1) */
  even?: number;
}

/**
 * One valve: a sine through the waveshaper. Its drive starts dark, reaches a bright blip at the end of the attack, settles, and falls back in the
 * release. Soft notes sit where the drive is nearly linear, so the start and the release are also held to at least 40% and 70% of the settled drive.
 */
function valve(ctx: BaseAudioContext, v: ValveNote): { s: OscillatorNode; pre: GainNode; out: AudioNode } {
  const { f, t0, F } = v;
  const drive = (k: number) => Math.min(VALVE_MAX - (v.headroom ?? 0), valveDrive(f, F * k));
  const s = osc(ctx, 'sine', f, t0, v.end);
  const pre = gainNode(ctx, 0);
  const p = pre.gain;
  p.setValueAtTime(Math.max(drive(v.start ?? 0.3), drive(1) * 0.4), t0);
  p.linearRampToValueAtTime(drive(v.blip ?? 1.1), t0 + v.att);
  p.setTargetAtTime(drive(1), t0 + v.att, 0.08);
  p.setTargetAtTime(Math.max(drive(0.5), drive(1) * 0.7), v.off, v.rel);
  const ws = ctx.createWaveShaper();
  ws.curve = valveCurve(v.even ?? 1);
  s.connect(pre).connect(ws);
  return { s, pre, out: ws };
}

/** When adsr starts the release */
const releaseAt = (t: number, dur: number, att: number): number => t + Math.max(dur, Math.min(att, Math.max(0.003, dur * 0.9)) + 0.005);

// ───────────────────────── Woodwinds ─────────────────────────

/**
 * Flute family: an air jet driving a pipe (see the valves above), so the low register is rich and the top nearly a sine, and the tone opens up with
 * dynamics. F: how fast the harmonics fall at velocity 1 (Hz); even: the even harmonics' share (a pipe stopped at the bottom, like the pan pipes,
 * has mostly odd ones); breath noise and the "chiff" of the attack; the pitch starts a little sharp; a delayed vibrato.
 */
function flute(F: number, even: number, breath: number, chiff: number, vibDepth: number, level: number): Voice {
  return (c) => {
    const { ctx, t, f, vel, o } = c;
    const a = o.attack ?? 0.05;
    const r = o.release ?? 0.12;
    const g = gainNode(ctx, 0);
    const Fv = F * Math.pow(Math.max(0.05, vel), 1.3) * (o.bright ?? 1);
    const norm = valveRms(ctx.sampleRate, f, valveDrive(f, Fv), 120, 9000, even);
    const peak = (vel * level) / norm;
    const end = adsr(g, t, c.dur, peak, a, 0.2, 0.88, r, peak * 1e-3);
    const band = bandOf(ctx, 120, 9000);
    band.connect(g).connect(c.out);
    const v = valve(ctx, { f, t0: t, end, F: Fv, att: a, off: releaseAt(t, c.dur, a), rel: r, start: 0.6, blip: 1.05, even });
    v.out.connect(band);
    const s = v.s;
    // The pitch starts slightly high and falls down to settle
    s.detune.setValueAtTime(18, t);
    s.detune.setTargetAtTime(0, t, 0.02);
    // Breath noise and the attack "chiff" share one stretch of pre-filtered noise (scaled to sit against the tone as before: norm·√2)
    const ng = gainNode(ctx, 0);
    const k = norm * Math.SQRT2;
    ng.gain.setValueAtTime(chiff * vel * 1.2 * k, t);
    ng.gain.linearRampToValueAtTime(breath * (o.breath ?? 1) * k, t + 0.05);
    breathSrc(ctx, t, end).connect(ng).connect(g);
    vibrato(ctx, [s.detune], t, end, o.vibRate ?? 5.2, o.vib ?? vibDepth, o.vibDelay ?? 0.28);
    applyBends(s.frequency, c, 1, o.glide ?? 0.06);
  };
}

/**
 * Reed woodwinds (clarinet, oboe, bassoon): the reed is a valve (see above), so the tone opens up with dynamics. F: how fast the harmonics fall at
 * velocity 1 and middle C (Hz); even(f): the even harmonics' share at pitch f; lo, hi: the radiation's rise and the roll-off (Hz); formants:
 * [frequency, Q, gain dB]; perPitch: how much F follows the pitch (0: the fall-off is fixed in hertz; the clarinet's odd harmonics fall off
 * more per harmonic than per hertz, roughly as a square wave's do below the cutoff).
 * The clarinet's cylindrical bore resonates only at odd multiples below the cutoff of its open tone holes (about 1.5-2 kHz): its low register is
 * mostly odd harmonics, and the even ones come back as the second harmonic nears the cutoff, in the upper register. The oboe's and bassoon's
 * conical bores keep them all.
 */
function reed(F: number, even: (f: number) => number, lo: number, hi: number, formants: [number, number, number][], vibDepth: number, level: number, perPitch = 0): Voice {
  return (c) => {
    const { ctx, t, f, vel, o } = c;
    const att = o.attack ?? 0.035;
    const rel = o.release ?? 0.1;
    const e = even(f);
    const g = gainNode(ctx, 0);
    const Fv = F * Math.pow(Math.max(0.05, vel), 1.3) * Math.pow(f / 262, perPitch) * (o.bright ?? 1);
    const peak = (vel * level) / valveRms(ctx.sampleRate, f, valveDrive(f, Fv), lo, hi, e);
    const end = adsr(g, t, c.dur, peak, att, 0.15, 0.85, rel, peak * 1e-3);
    const band = bandOf(ctx, lo, hi);
    let node: AudioNode = band;
    for (const [ff, q, gain] of formants) node = node.connect(filt(ctx, 'peaking', ff, q, gain));
    node.connect(g).connect(c.out);
    const v = valve(ctx, { f, t0: t, end, F: Fv, att, off: releaseAt(t, c.dur, att), rel, even: e });
    v.out.connect(band);
    vibrato(ctx, [v.s.detune], t, end, 5, o.vib ?? vibDepth, 0.35);
    applyBends(v.s.frequency, c, 1, o.glide ?? 0.05);
  };
}

/** The clarinet's even harmonics: weak while the second harmonic sits below the tone-hole cutoff (about 1.7 kHz), returning above it */
const clarinetEven = (f: number): number => {
  const q = (2 * f) / 1700;
  return 0.04 + (0.6 * q * q) / (1 + q * q);
};

/**
 * Saxophone: a reed on a conical bore. The cone's resonances line up with every harmonic, so the reed's puffs keep them all (the clarinet's
 * cylinder favours the odd ones), and the reed is the same kind of valve as a brass player's lips: mellow when soft, bright and edgy when loud.
 * The body gives two formants (alto about 550 Hz and 1.5-2.5 kHz, tenor lower: f1 and f2) with a dip between them. The breath's edge grows
 * with velocity, and a loud note growls a little: the throat roughens the airflow at about 30 Hz, which shakes the drive and so both the
 * loudness and the brightness. Accented notes are tongued fast and scoop up from below; held notes get a late vibrato.
 * o.growl scales the growl (0 for none) and o.breath the breath noise.
 */
function saxV(F: number, f1: number, f2: number, level: number): Voice {
  // The two formants as peaking filters (gain in dB): their response, for level matching across the range
  const formant = (w: number, fc: number, q: number) => 9 / (1 + q * q * (w / fc - fc / w) ** 2);
  const eq = (w: number) => Math.pow(10, (formant(w, f1, 1.6) + formant(w, f2, 1.3)) / 20);
  return (c) => {
    const { ctx, t, f, vel, o } = c;
    const att = o.attack ?? 0.018;
    const rel = o.release ?? 0.12;
    const g = gainNode(ctx, 0);
    const lo = f1 * 0.45;
    const body = bandOf(ctx, lo, 5000);
    body.connect(filt(ctx, 'peaking', f1, 1.6, 9)).connect(filt(ctx, 'peaking', f2, 1.3, 9)).connect(g).connect(c.out);
    // The saxophone's tone changes more with dynamics than the others': mellow when soft, edgy when loud
    const Fv = F * Math.pow(Math.max(0.05, vel), 1.6) * (o.bright ?? 1);
    // How far into forte: sets the growl, the breath edge and the scoop
    const loud = Math.min(1, Math.max(0, (vel - 0.72) / 0.28));
    // Near the curve's pole a small change of drive is a large change of tone, so the growl takes a share of the room left below it
    const A = valveDrive(f, Fv);
    const growl = 0.6 * loud * Math.min(1, o.growl ?? 1) * (VALVE_MAX - A);
    const norm = valveRms(ctx.sampleRate, f, Math.min(VALVE_MAX - growl, A), lo, 5000, 1, eq);
    const peak = (vel * level) / norm;
    const end = adsr(g, t, c.dur, peak, att, 0.2, 0.85, rel, peak * 1e-3);
    const v = valve(ctx, { f, t0: t, end, F: Fv, att, off: releaseAt(t, c.dur, att), rel, blip: 1.15, headroom: growl });
    v.out.connect(body);
    // Scoop: an accented note starts up to 70 cents flat and is lipped up to pitch
    v.s.detune.setValueAtTime(-10 - 60 * loud, t);
    v.s.detune.setTargetAtTime(0, t + 0.01, 0.025);
    if (growl > 0) osc(ctx, 'sine', 27 + Math.random() * 7, t, end).connect(gainNode(ctx, growl)).connect(v.pre.gain);
    // Breath: a puff as the tongue releases the reed, then the edge of the air in the mouthpiece, stronger the harder it is blown
    const ng = gainNode(ctx, 0);
    const edge = (o.breath ?? 1) * norm * 0.04 * (0.3 + loud);
    ng.gain.setValueAtTime(edge * 4, t);
    ng.gain.setTargetAtTime(edge, t + 0.01, 0.02);
    breathSrc(ctx, t, end).connect(ng).connect(g);
    vibrato(ctx, [v.s.detune], t, end, o.vibRate ?? 5.3, o.vib ?? 16, o.vibDelay ?? 0.4);
    applyBends(v.s.frequency, c, 1, o.glide ?? 0.05);
  };
}

// ───────────────────────── Brass ─────────────────────────
//
// Brass: a lip valve (see above), the bell and the mouthpiece cup. The bell radiates the low harmonics poorly (rising about 6 dB per octave up to
// its cutoff, then flat) and the cup rolls off the top: a first-order high-pass and a first-order low-pass. With the valve's fall-off they place
// the formant: around 1.2-1.5 kHz for the trumpet, 500-600 Hz for the trombone, 300-400 Hz for the horn (whose bell faces away from the
// listener and loses the highs above about 1.3 kHz), about 230 Hz for the tuba.

/**
 * Brass. F: how fast the harmonics fall at velocity 1 (Hz, larger is brighter); lo, hi: the bell's radiation cutoff and the cup's low-pass (Hz);
 * players: 1 for a soloist, more for a section; o.bright scales the brightness.
 * A section's players are independent: each enters 4-30 ms apart, sits a few cents off and blows a little harder or softer,
 * so the section shimmers rather than beating like phase-locked copies.
 */
function brassV(F: number, lo: number, hi: number, players: number, vibDepth: number, level: number): Voice {
  return (c) => {
    const { ctx, t, f, vel, o } = c;
    const att = o.attack ?? 0.045;
    const rel = o.release ?? 0.14;
    const g = gainNode(ctx, 0);
    const bell = bandOf(ctx, lo, hi);
    bell.connect(g).connect(c.out);
    // Brightness: the harmonics' fall-off F grows with velocity
    const Fv = F * Math.pow(Math.max(0.05, vel), 1.3) * (o.bright ?? 1);
    const peak = (vel * level) / valveRms(ctx.sampleRate, f, valveDrive(f, Fv), lo, hi);
    const end = adsr(g, t, c.dur, peak, att, 0.25, 0.8, rel, peak * 1e-3);
    const off = releaseAt(t, c.dur, att);
    const oscs: OscillatorNode[] = [];
    for (let i = 0; i < players; i++) {
      const solo = players === 1;
      const t0 = t + (solo || i === 0 ? 0 : 0.004 + Math.random() * 0.026);
      const d = solo ? 0 : (i / (players - 1) - 0.5) * 10 + (Math.random() - 0.5) * 6;
      const v = valve(ctx, { f, t0, end, F: Fv * (solo ? 1 : 0.85 + Math.random() * 0.3), att, off, rel });
      // The lips start a little flat and settle onto the note
      v.s.detune.setValueAtTime(d - 25, t0);
      v.s.detune.linearRampToValueAtTime(d, t0 + 0.04);
      v.out.connect(solo ? bell : panned(ctx, bell, (i / (players - 1) - 0.5) * 0.5));
      oscs.push(v.s);
    }
    vibrato(ctx, oscs.map((s) => s.detune), t, end, 5, o.vib ?? vibDepth, 0.35);
    oscs.forEach((s) => applyBends(s.frequency, c, 1, o.glide ?? 0.07));
  };
}

const harmonics = (n: number, pow: number, odd = 1): number[] => Array.from({ length: n }, (_, i) => ((i + 1) % 2 === 0 ? odd : 1) / Math.pow(i + 1, pow));

// ───────────────────────── Voices ─────────────────────────

/** Vowel formants: [frequency, bandwidth, gain] */
const VOWELS: Record<string, [number, number, number][]> = {
  a: [[800, 80, 1], [1150, 90, 0.5], [2900, 120, 0.1], [3900, 130, 0.06]],
  o: [[450, 70, 1], [800, 80, 0.3], [2830, 100, 0.05]],
  u: [[325, 50, 1], [700, 60, 0.15], [2530, 170, 0.03]],
  e: [[400, 60, 1], [1600, 80, 0.25], [2700, 120, 0.12]],
  i: [[300, 50, 1], [2200, 90, 0.2], [3000, 120, 0.15]],
  /** Male voice */
  A: [[650, 80, 1], [1080, 90, 0.5], [2650, 120, 0.2], [2900, 130, 0.12]],
  O: [[400, 70, 1], [750, 80, 0.4], [2400, 100, 0.08]],
  U: [[350, 60, 1], [600, 60, 0.2], [2400, 170, 0.03]],
};

/** Choir: vowel formants baked into the waveform; n voices, each detuned and with vibrato (two LFOs, one positive and one inverted), spread left and right */
function choirV(vowel: string, n: number, spread: number, vibDepth: number, breathy = 0): Voice {
  const fs = VOWELS[vowel].map(([F, bw, g]) => [F, bw * 3, g] as [number, number, number]);
  return (c) => {
    const { ctx, t, f, vel, o } = c;
    const g = gainNode(ctx, 0);
    const end = adsr(g, t, c.dur, vel * 0.5, o.attack ?? 0.25, 0.3, 0.9, o.release ?? 0.5);
    g.connect(c.out);
    const w = baked(ctx, `v${vowel}`, f, (k, hz) => peaks(hz, fs) / Math.pow(k, 0.6) + 0.002 / k, 7000);
    const voices: OscillatorNode[] = [];
    for (let i = 0; i < n; i++) {
      const det = n === 1 ? 0 : (i / (n - 1) - 0.5) * 2 * spread;
      const s = osc(ctx, w, f, t, end, det);
      s.connect(panned(ctx, g, n === 1 ? 0 : (i / (n - 1) - 0.5) * 0.8));
      applyBends(s.frequency, c, 1, o.glide ?? 0.12);
      voices.push(s);
    }
    const depth = o.vib ?? vibDepth;
    if (depth > 0) {
      const l1 = osc(ctx, 'sine', 4.9 + Math.random() * 0.3, t, end);
      const l2 = osc(ctx, 'sine', 5.6 + Math.random() * 0.3, t, end);
      voices.forEach((v, i) => {
        const lg = ctx.createGain();
        lg.gain.setValueAtTime(0, t);
        lg.gain.linearRampToValueAtTime(depth * (i % 3 === 2 ? -1 : 1), t + 0.5);
        (i % 2 ? l2 : l1).connect(lg).connect(v.detune);
      });
    }
    if (breathy > 0) {
      const nn = noiseSrc(ctx, t, end);
      nn.connect(filt(ctx, 'bandpass', 2500, 0.8)).connect(gainNode(ctx, breathy)).connect(g);
    }
  };
}

/** Throat singing (khoomei): a sustained low note, with a narrow band-pass wandering along the harmonic series to sing a whistle-like second melody */
const throat: Voice = (c) => {
  const { ctx, t, f, vel, o } = c;
  const g = gainNode(ctx, 0);
  const end = adsr(g, t, c.dur, vel * 0.5, o.attack ?? 0.3, 0.2, 0.9, o.release ?? 0.4);
  g.connect(c.out);
  const s = osc(ctx, 'sawtooth', f, t, end);
  const s2 = osc(ctx, 'sawtooth', f, t, end, 5);
  const src = gainNode(ctx, 0.5);
  s.connect(src);
  s2.connect(src);
  // Chest resonance
  src.connect(filt(ctx, 'bandpass', 420, 2)).connect(gainNode(ctx, 1.3)).connect(g);
  src.connect(filt(ctx, 'lowpass', 300, 0.7)).connect(gainNode(ctx, 0.5)).connect(g);
  // Whistle overtones: a narrow band-pass moving between the 6th and 12th harmonics
  const bp = filt(ctx, 'bandpass', f * 8, 40);
  const bp2 = filt(ctx, 'bandpass', f * 8, 40);
  src.connect(bp).connect(bp2).connect(gainNode(ctx, 22 * (o.whistle ?? 1))).connect(g);
  const seq = [8, 9, 10, 9, 8, 12, 10, 8];
  const step = Math.max(0.35, c.dur / seq.length);
  let tt = t;
  for (let i = 0; tt < end; i++, tt += step) {
    const h = seq[i % seq.length] * f;
    bp.frequency.setTargetAtTime(h, tt, 0.06);
    bp2.frequency.setTargetAtTime(h, tt, 0.06);
  }
  vibrato(ctx, [s.detune, s2.detune], t, end, 4.4, 4, 0.5);
};

// ───────────────────────── Keyboards and reed organs ─────────────────────────

/** Organ: stops (overtones) + the airflow noise of the attack; o.full=1 opens all the stops (adds the 16' and mixture stops) */
const organ: Voice = (c) => {
  const { ctx, t, f, vel, o } = c;
  const full = (o.full ?? 0) > 0;
  const g = gainNode(ctx, 0);
  const end = adsr(g, t, c.dur, vel * 0.14, 0.04, 0, 1, o.release ?? 0.3);
  const lp = filt(ctx, 'lowpass', full ? 9000 : 5000, 0.5);
  lp.connect(g).connect(c.out);
  const flue = full ? [1, 0.8, 0.45, 0.6, 0, 0.35, 0, 0.3, 0, 0, 0, 0.18, 0, 0, 0, 0.12] : [1, 0.55, 0.2, 0.3, 0, 0.12, 0, 0.1];
  const w = wave(ctx, full ? 'orgF' : 'orgP', flue);
  osc(ctx, w, f, t, end).connect(lp);
  // A slightly detuned second rank of stops (celeste)
  osc(ctx, w, f, t, end, 3).connect(panned(ctx, lp, 0.3));
  if (full) osc(ctx, 'sine', f / 2, t, end).connect(gainNode(ctx, 0.7)).connect(lp);
  const cn = noiseSrc(ctx, t, t + 0.12);
  const cg = gainNode(ctx, 0);
  cg.gain.setValueAtTime(0.1 * vel, t);
  fadeTo0(cg.gain, t + 0.01, 0.025);
  cn.connect(filt(ctx, 'bandpass', f * 3, 2)).connect(cg).connect(c.out);
};

/** Accordion (musette): two ranks of reeds detuned against each other beat in a "wah-wah", plus the bellows' dynamics */
const accordion: Voice = (c) => {
  const { ctx, t, f, vel, o } = c;
  const g = gainNode(ctx, 0);
  const end = adsr(g, t, c.dur, vel * 0.1, o.attack ?? 0.03, 0.2, 0.85, o.release ?? 0.08);
  const bp = filt(ctx, 'peaking', 1400, 1, 5);
  const lp = filt(ctx, 'lowpass', 4200, 0.6);
  bp.connect(lp).connect(g).connect(c.out);
  const w = wave(ctx, 'reed', harmonics(14, 0.75));
  for (const d of [-(o.musette ?? 13), 0, o.musette ?? 13]) osc(ctx, w, f, t, end, d).connect(bp);
};

/** Bagpipe / drone: a narrow-band sawtooth, very long and steady */
const drone: Voice = (c) => {
  const { ctx, t, f, vel, o } = c;
  const g = gainNode(ctx, 0);
  const end = adsr(g, t, c.dur, vel * 0.12, o.attack ?? 0.4, 0, 1, o.release ?? 0.6);
  const bp = filt(ctx, 'bandpass', f * 3, 0.9);
  const lp = filt(ctx, 'lowpass', 2500, 0.5);
  bp.connect(lp).connect(g).connect(c.out);
  osc(ctx, 'sawtooth', f, t, end).connect(bp);
  osc(ctx, 'sawtooth', f * 1.5, t, end, 2).connect(gainNode(ctx, 0.5)).connect(bp);
};

// ───────────────────────── Synthesizers ─────────────────────────

/** Chord pad: kind 0 warm (sawtooth low-pass), 1 glass (sine + FM sparkle), 2 dark (very low low-pass + sub-bass), 3 air (narrow-band noise) */
function padV(kind: 0 | 1 | 2 | 3): Voice {
  return (c) => {
    const { ctx, t, f, vel, o } = c;
    const g = gainNode(ctx, 0);
    const end = adsr(g, t, c.dur, vel * (kind === 3 ? 0.9 : kind === 1 ? 0.16 : 0.1), o.attack ?? 0.9, 0, 1, o.release ?? 1.2);
    g.connect(c.out);
    if (kind === 3) {
      const n = noiseSrc(ctx, t, end);
      const bp = filt(ctx, 'bandpass', f, 60);
      const bp2 = filt(ctx, 'bandpass', f * 2, 60);
      n.connect(bp).connect(gainNode(ctx, 1.2)).connect(g);
      n.connect(bp2).connect(gainNode(ctx, 0.5)).connect(g);
      return;
    }
    if (kind === 1) {
      const s = osc(ctx, 'sine', f, t, end);
      const m = osc(ctx, 'sine', f * 2.001, t, end);
      const mg = gainNode(ctx, f * 0.6);
      m.connect(mg).connect(s.frequency);
      const sh = osc(ctx, 'sine', f * 4, t, end, 6);
      s.connect(panned(ctx, g, -0.3));
      sh.connect(gainNode(ctx, 0.12)).connect(panned(ctx, g, 0.3));
      // A slowly breathing brightness
      const l = osc(ctx, 'sine', 0.18 + Math.random() * 0.1, t, end);
      l.connect(gainNode(ctx, f * 0.4)).connect(mg.gain);
      return;
    }
    const cut = kind === 2 ? 520 : o.cut ?? 1300;
    const lp = filt(ctx, 'lowpass', cut, 0.8);
    lp.connect(g);
    // The filter slowly opens and closes
    const l = osc(ctx, 'sine', 0.12 + Math.random() * 0.08, t, end);
    l.connect(gainNode(ctx, cut * 0.35)).connect(lp.frequency);
    for (const [d, p] of [[-11, -0.6], [0, 0], [11, 0.6]] as const) osc(ctx, 'sawtooth', f, t, end, d).connect(panned(ctx, lp, p));
    if (kind === 2) osc(ctx, 'sine', f / 2, t, end).connect(gainNode(ctx, 0.6)).connect(g);
  };
}

/** Glass harmonica: two nearly unison sines beat against each other, slow attack */
const glass: Voice = (c) => {
  const { ctx, t, f, vel, o } = c;
  const g = gainNode(ctx, 0);
  const end = adsr(g, t, c.dur, vel * 0.22, o.attack ?? 0.18, 0.5, 0.7, o.release ?? 0.8);
  g.connect(c.out);
  osc(ctx, 'sine', f, t, end).connect(panned(ctx, g, -0.25));
  osc(ctx, 'sine', f, t, end, 7).connect(panned(ctx, g, 0.25));
  osc(ctx, 'sine', f * 2, t, end, 3).connect(gainNode(ctx, 0.18)).connect(g);
};

/** Synth lead: sawtooth + square, low-pass, glide and vibrato */
const synthLead: Voice = (c) => {
  const { ctx, t, f, vel, o } = c;
  const g = gainNode(ctx, 0);
  const end = adsr(g, t, c.dur, vel * 0.12, o.attack ?? 0.01, 0.2, 0.75, o.release ?? 0.1);
  const lp = filt(ctx, 'lowpass', o.cut ?? 3200, 2);
  lp.connect(g).connect(c.out);
  const s1 = osc(ctx, 'sawtooth', f, t, end, -6);
  const s2 = osc(ctx, 'square', f, t, end, 6);
  s1.connect(lp);
  s2.connect(gainNode(ctx, 0.6)).connect(lp);
  vibrato(ctx, [s1.detune, s2.detune], t, end, 5.8, o.vib ?? 14, 0.2);
  applyBends(s1.frequency, c, 1, o.glide ?? 0.05);
  applyBends(s2.frequency, c, 1, o.glide ?? 0.05);
};

/** Overdrive curve (each computed only once) */
const curves = new Map<string, Float32Array<ArrayBuffer>>();
function tanhCurve(drive: number, n: number, norm = true): Float32Array<ArrayBuffer> {
  const k = `${drive}|${n}|${norm}`;
  let c = curves.get(k);
  if (!c) {
    c = new Float32Array(n);
    for (let i = 0; i < n; i++) c[i] = Math.tanh(((i / (n - 1)) * 2 - 1) * drive) / (norm ? Math.tanh(drive) : 1);
    curves.set(k, c);
  }
  return c;
}

/** Distorted guitar: root + fifth + octave into overdrive, then through a cabinet; o.mute=1 is palm muting */
const powerGtr: Voice = (c) => {
  const { ctx, t, f, vel, o } = c;
  const mute = (o.mute ?? 0) > 0;
  const g = gainNode(ctx, 0);
  const end = mute ? adsr(g, t, Math.min(c.dur, 0.12), vel * 0.14, 0.004, 0.08, 0.3, 0.06) : adsr(g, t, c.dur, vel * 0.13, 0.005, 0.8, 0.6, 0.12);
  const ws = ctx.createWaveShaper();
  ws.curve = tanhCurve(o.drive ?? 7, 1024);
  const pre = gainNode(ctx, 0.5);
  const cab = filt(ctx, 'lowpass', mute ? 1500 : 3400, 1.1);
  const hp = filt(ctx, 'highpass', 90, 0.7);
  const mid = filt(ctx, 'peaking', 750, 1, -5);
  pre.connect(ws).connect(hp).connect(mid).connect(cab).connect(g).connect(c.out);
  for (const [ratio, det] of [[1, -5], [1.5, 4], [2, 3], [1, 8]] as const) osc(ctx, 'sawtooth', f * ratio, t, end, det).connect(pre);
};

// ───────────────────────── Bass ─────────────────────────

/** Fingerstyle bass: sine + triangle, a plucked-string low-pass envelope */
const fingerBass: Voice = (c) => {
  const { ctx, t, f, vel, o } = c;
  const g = gainNode(ctx, 0);
  const end = adsr(g, t, c.dur, vel * 0.5, 0.006, 0.6, 0.55, o.release ?? 0.08);
  const lp = filt(ctx, 'lowpass', 400, 1);
  lp.frequency.setValueAtTime(900 + vel * 900, t);
  lp.frequency.setTargetAtTime(350, t, 0.12);
  lp.connect(g).connect(c.out);
  osc(ctx, 'sine', f, t, end).connect(lp);
  osc(ctx, 'triangle', f, t, end).connect(gainNode(ctx, 0.6)).connect(lp);
  osc(ctx, 'sawtooth', f, t, end).connect(gainNode(ctx, 0.12)).connect(lp);
};

/** Synth bass: the envelope of a resonant low-pass goes "bwop" */
const synthBass: Voice = (c) => {
  const { ctx, t, f, vel, o } = c;
  const g = gainNode(ctx, 0);
  const end = adsr(g, t, c.dur, vel * 0.32, 0.004, 0.3, 0.7, o.release ?? 0.06);
  const lp = filt(ctx, 'lowpass', 200, o.q ?? 6);
  lp.frequency.setValueAtTime(Math.min(6000, f * (6 + vel * 10)), t);
  lp.frequency.setTargetAtTime(f * 2.2, t, o.env ?? 0.08);
  lp.connect(g).connect(c.out);
  osc(ctx, 'sawtooth', f, t, end, -4).connect(lp);
  osc(ctx, 'sawtooth', f, t, end, 4).connect(lp);
  osc(ctx, 'sine', f / 2, t, end).connect(gainNode(ctx, 0.8)).connect(g);
  const s = osc(ctx, 'square', f, t, end);
  s.connect(gainNode(ctx, 0.3)).connect(lp);
  applyBends(s.frequency, c);
};

/** Sub-bass: a pure sine */
const subBass: Voice = (c) => {
  const { ctx, t, f, vel, o } = c;
  const g = gainNode(ctx, 0);
  const end = adsr(g, t, c.dur, vel * 0.55, o.attack ?? 0.01, 0, 1, o.release ?? 0.1);
  g.connect(c.out);
  const s = osc(ctx, 'sine', f, t, end);
  s.connect(g);
  applyBends(s.frequency, c);
};

/** Distorted bass: sawtooth + square overdriven */
const distBass: Voice = (c) => {
  const { ctx, t, f, vel, o } = c;
  const g = gainNode(ctx, 0);
  const end = adsr(g, t, c.dur, vel * 0.26, 0.005, 0.3, 0.8, o.release ?? 0.06);
  const ws = ctx.createWaveShaper();
  ws.curve = tanhCurve(4, 512, false);
  const lp = filt(ctx, 'lowpass', o.cut ?? 1400, 1.2);
  const pre = gainNode(ctx, 0.6);
  pre.connect(ws).connect(lp).connect(g).connect(c.out);
  osc(ctx, 'sawtooth', f, t, end).connect(pre);
  osc(ctx, 'square', f / 2, t, end).connect(pre);
  osc(ctx, 'sine', f / 2, t, end).connect(gainNode(ctx, 0.6)).connect(g);
};

// ───────────────────────── Ambience ─────────────────────────




/** Birdsong: random sine glide chirps */
const birds: Voice = (c) => {
  const { ctx, t, vel } = c;
  const end = t + c.dur;
  const r = rng(Math.floor(t * 53) + 7);
  for (let tt = t + Math.abs(r()) * 1.5; tt < end - 0.4; tt += 0.6 + Math.abs(r()) * 2.8) {
    const base = 2600 + Math.abs(r()) * 2400;
    const notes = 2 + Math.floor(Math.abs(r()) * 4);
    const pan = r() * 0.8;
    for (let k = 0; k < notes; k++) {
      const st = tt + k * (0.07 + Math.abs(r()) * 0.05);
      const s = osc(ctx, 'sine', base, st, st + 0.09);
      s.frequency.setValueAtTime(base * (1 + r() * 0.1), st);
      s.frequency.exponentialRampToValueAtTime(base * (1.3 + r() * 0.3), st + 0.06);
      const g = gainNode(ctx, 0);
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(vel * 0.05, st + 0.01);
      g.gain.linearRampToValueAtTime(0, st + 0.08);
      s.connect(g).connect(panned(ctx, c.out, pan));
    }
  }
};



/** Riser: band-pass noise and a sawtooth sweep upward together, reaching the top when the note ends and cutting off instantly (leading into the next beat's heavy hit) */
const riser: Voice = (c) => {
  const { ctx, t, vel, o } = c;
  const end = t + c.dur;
  const g = gainNode(ctx, 0);
  g.gain.setValueAtTime(1e-4, t);
  g.gain.exponentialRampToValueAtTime(vel * 0.8, end);
  g.gain.linearRampToValueAtTime(0, end + 0.03);
  g.connect(c.out);
  const n = noiseSrc(ctx, t, end + 0.05);
  const bp = filt(ctx, 'bandpass', o.from ?? 260, 1.6);
  bp.frequency.setValueAtTime(o.from ?? 260, t);
  bp.frequency.exponentialRampToValueAtTime(o.to ?? 7000, end);
  n.connect(bp).connect(g);
  const s = osc(ctx, 'sawtooth', 110, t, end + 0.05);
  s.frequency.exponentialRampToValueAtTime(440, end);
  s.connect(filt(ctx, 'lowpass', 1200, 0.7)).connect(gainNode(ctx, 0.25)).connect(g);
};

// ───────────────────────── Catalog ─────────────────────────

export const VOICES = {
  flute: flute(1900, 1, 0.05, 0.25, 11, 0.22),
  /** Pan flute: stopped pipes (odd harmonics), lots of breath, a very noticeable chiff on the attack */
  panflute: flute(1230, 0.15, 0.12, 0.55, 8, 0.21),
  /** Ocarina: a vessel (Helmholtz) resonator with no overtones of its own, nearly a sine */
  ocarina: flute(540, 1, 0.025, 0.1, 6, 0.22),
  /** Tin whistle: bright, thin, with lots of ornaments */
  whistle: flute(2200, 1, 0.06, 0.35, 9, 0.22),
  clarinet: reed(845, clarinetEven, 100, 3000, [[1500, 1, 2]], 5, 0.15, 0.67),
  oboe: reed(2500, () => 1, 500, 6000, [[1100, 1.8, 7], [2800, 2, 5]], 10, 0.059),
  bassoon: reed(700, () => 1, 150, 4000, [[500, 1.5, 6], [1150, 2, 4]], 6, 0.064),
  horn: brassV(1100, 400, 1300, 1, 5, 0.15),
  horns: brassV(1100, 400, 1300, 2, 4, 0.15),
  trumpet: brassV(1700, 1300, 6000, 1, 7, 0.115),
  trumpets: brassV(1700, 1300, 6000, 3, 5, 0.13),
  trombone: brassV(1700, 700, 4000, 1, 3, 0.16),
  tuba: brassV(500, 150, 1000, 1, 2, 0.145),
  /** Saxophones: alto and tenor */
  sax: saxV(4200, 560, 1900, 0.17),
  tenorSax: saxV(3600, 420, 1450, 0.17),
  /** Choir (female voices on the vowels a, o, u) and male voices (A, O, U) */
  choir: choirV('a', 3, 12, 16),
  choirOo: choirV('u', 3, 10, 12),
  choirO: choirV('o', 3, 10, 14),
  /** Male choir */
  menChoir: choirV('A', 3, 14, 10),
  /** Monk chant: a male o with almost no vibrato */
  chant: choirV('O', 3, 6, 2),
  /** Solo soprano (aria) */
  soprano: choirV('a', 1, 0, 45, 0.02),
  throat,
  organ,
  /** Organ with all stops */
  organFull: (c) => organ({ ...c, o: { full: 1, ...c.o } }),
  accordion,
  drone,
  warmPad: padV(0),
  glassPad: padV(1),
  darkPad: padV(2),
  airPad: padV(3),
  glass,
  synthLead,
  powerGtr,
  muteGtr: (c) => powerGtr({ ...c, o: { mute: 1, ...c.o } }),
  bass: fingerBass,
  synthBass,
  sub: subBass,
  distBass,
  birds,
  riser,
} satisfies Record<string, Voice>;
