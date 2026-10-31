// Live-synthesized sustained instruments: flutes, reeds, saxophones, brass, choir, organ, accordion, throat singing (khoomei), synthesizers
// (supersaw, leads, plucks, pads, basses), distorted guitar, ambience.
// Each note builds a small graph of Web Audio nodes; sampled instruments (plucked strings, bells, drums) are rendered offline in dsp/ instead.

import { rng } from './dsp/core.ts';

export interface VoiceCall {
  ctx: BaseAudioContext;
  out: AudioNode;
  t: number;
  /** Note length (seconds) */
  dur: number;
  f: number;
  /** Loudness: the velocity through a curve, times the instrument's level */
  vel: number;
  /** The velocity as played (0-1), for timbre: how far a filter opens, whether a note is accented */
  touch: number;
  /** Glide: [seconds from the start, target frequency] */
  bends?: [number, number][];
  /** Instrument parameters (a song's track.params can override them) */
  o: Readonly<Record<string, number>>;
}

export type Voice = (c: VoiceCall) => void;

// ───────────────────────── Shared parts ─────────────────────────

const waves = new WeakMap<BaseAudioContext, Map<string, PeriodicWave>>();
/** A periodic wave from a custom harmonic table (organ, accordion), starting `phase` (a fraction of a cycle) into it */
function wave(ctx: BaseAudioContext, key: string, amps: number[], phase = 0): PeriodicWave {
  let m = waves.get(ctx);
  if (!m) waves.set(ctx, (m = new Map()));
  const k = phase ? `${key}@${phase}` : key;
  let w = m.get(k);
  if (!w) {
    const real = new Float32Array(amps.length + 1);
    const imag = new Float32Array(amps.length + 1);
    amps.forEach((a, i) => {
      real[i + 1] = a * Math.sin(2 * Math.PI * (i + 1) * phase);
      imag[i + 1] = a * Math.cos(2 * Math.PI * (i + 1) * phase);
    });
    w = ctx.createPeriodicWave(real, imag);
    m.set(k, w);
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
//
// Subtractive synthesis as analog polysynths do it. The oscillators run free: each note starts them at a random point of their cycle and a cent
// or two off pitch, so repeated notes are never quite the same. The filter is a four-pole low-pass (24 dB/oct, like a Moog or Roland transistor
// ladder) whose cutoff follows the keyboard and whose envelope sweeps it in octaves, as an exponential converter does, opening further the harder
// a note is played. A stereo voice is two channel strips, left and right, each a mono filter and amplifier.
// Every note unplugs itself from its destination when it ends: Chrome keeps processing a finished note's nodes for as long as they stay connected
// (until garbage collection reaches them), and a song that left its notes plugged in grew heavier with every note (ten times the CPU by bar 16).

const SAW = harmonics(1024, 1);
const SQUARE = harmonics(1024, 1, 0);

/** An oscillator that runs free: it starts at one of 16 points of its cycle and up to `wobble` cents off pitch, both at random */
function vco(ctx: BaseAudioContext, kind: 'saw' | 'square', f: number, t: number, end: number, cents = 0, wobble = 2): OscillatorNode {
  const phase = Math.floor(Math.random() * 16) / 16;
  return osc(ctx, wave(ctx, kind, kind === 'saw' ? SAW : SQUARE, phase), f, t, end, cents + (Math.random() - 0.5) * 2 * wobble);
}

/** A four-pole low-pass (24 dB/oct, like a transistor ladder): a gentle biquad into one carrying the resonance q (dB) */
function ladder(ctx: BaseAudioContext, cut: number, q: number): [BiquadFilterNode, BiquadFilterNode] {
  const a = filt(ctx, 'lowpass', cut, -5.4);
  const b = filt(ctx, 'lowpass', cut, q);
  a.connect(b);
  return [a, b];
}

/** A cutoff that follows the keyboard: cut (Hz) at the pitch ref, moving `track` octaves for every octave played */
const keyCut = (cut: number, f: number, ref: number, track = 0.5): number => Math.min(20000, cut * Math.pow(f / ref, track));

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

/** Soft clipping (tanh) at the given drive, keeping a full-scale peak at full scale: 1 rounds the peaks, 4 is a crunchy overdrive */
function saturator(ctx: BaseAudioContext, drive: number): WaveShaperNode {
  const ws = ctx.createWaveShaper();
  ws.curve = tanhCurve(drive, 1024);
  return ws;
}

interface StripSpec {
  /** -1 left, 0 centre, 1 right */
  pan: number;
  /** Level of the oscillators coming in */
  level: number;
  /** Low-pass cutoff (Hz) and resonance (dB) */
  cut: number;
  q: number;
  /** Soft clipping after the filter, at this drive */
  drive?: number;
  /** A high-pass (Hz) after that */
  hp?: number;
}

interface Strip {
  /** Where the oscillators go */
  input: GainNode;
  /** The low-pass's two stages, for sweep */
  lp: BiquadFilterNode[];
  /** The amplifier, for amps */
  amp: GainNode;
  /** The node plugged into the destination, for unplug */
  out: AudioNode;
}

/** One channel strip of a synth voice, mono from end to end: input level, four-pole low-pass, soft clipping and high-pass if asked, amplifier, pan */
function strip(ctx: BaseAudioContext, out: AudioNode, s: StripSpec): Strip {
  const input = gainNode(ctx, s.level);
  const lp = ladder(ctx, s.cut, s.q);
  const amp = gainNode(ctx, 0);
  let node: AudioNode = input.connect(lp[0]).connect(lp[1]);
  if (s.drive) node = node.connect(saturator(ctx, s.drive));
  if (s.hp) node = node.connect(filt(ctx, 'highpass', s.hp, -3));
  const pan = panned(ctx, out, s.pan);
  node.connect(amp).connect(pan);
  return { input, lp, amp, out: pan === out ? amp : pan };
}

/** A stereo voice's strips, left and right */
const stereo = (ctx: BaseAudioContext, out: AudioNode, s: Omit<StripSpec, 'pan'>): Strip[] => [-1, 1].map((pan) => strip(ctx, out, { ...s, pan }));

/** The amplifier envelope (adsr) on every strip; returns when the sound ends */
function amps(strips: Strip[], t: number, dur: number, peak: number, a: number, d: number, s: number, r: number): number {
  let end = t;
  for (const st of strips) end = adsr(st.amp, t, dur, peak, a, d, s, r);
  return end;
}

/** Filter envelope on every strip, in octaves on the filters' detune: up oct octaves over att seconds, then back toward sus of that with time constant dec */
function sweep(strips: Strip[], t: number, oct: number, att: number, dec: number, sus = 0): void {
  for (const { lp } of strips) {
    for (const { detune: p } of lp) {
      p.setValueAtTime(0, t);
      p.linearRampToValueAtTime(oct * 1200, t + att);
      p.setTargetAtTime(oct * 1200 * sus, t + att, dec);
    }
  }
}

/** Unplug a note's nodes from its destination once its oscillator src has stopped (see above) */
function unplug(src: AudioScheduledSourceNode, nodes: AudioNode[]): void {
  src.onended = () => {
    for (const n of nodes) n.disconnect();
  };
}

/** A gain feeding every strip: the centre of a stereo voice */
function centre(ctx: BaseAudioContext, strips: Strip[], level: number): GainNode {
  const g = gainNode(ctx, level);
  for (const s of strips) g.connect(s.input);
  return g;
}

/** The JP-8000's six side saws: how far each sits from the pitch at full Detune, as a fraction of it (Szabo's measurements) */
const SUPERSAW = [-0.11002313, -0.06288439, -0.01952356, 0.01991221, 0.06216538, 0.10745242];
/** Szabo's fit of the Detune knob (0-1) to the amount of detune, highest power first: gentle over most of the travel, steep at the top */
const SUPERSAW_DETUNE = [10028.7312891634, -50818.8652045924, 111363.4808729368, -138150.6761080548, 106649.6679158292, -53046.9642751875, 17019.951858008, -3425.0836591318, 404.2703938388, -24.1878824391, 0.6717417634, 0.0030115596];

/**
 * Supersaw (Roland JP-8000), after Adam Szabo's measurements ("How to Emulate the Super Saw", 2010): seven free-running saws, the six side ones
 * detuned along the knob's curve and coming up as the centre one fades (Mix), and a high-pass at the fundamental that keeps the stack from turning
 * to mud. The side saws alternate left and right (each side gets flat and sharp ones), through a four-pole low-pass with a short sweep for bite.
 * Trance leads and big-room chord stabs. o.detune 0-1 (default 0.6), o.mix 0-1 (default 0.75), o.cut (Hz around C5, default 7000), o.q, o.attack, o.release, o.glide, o.vib.
 */
const supersaw: Voice = (c) => {
  const { ctx, t, f, vel, touch, o } = c;
  const x = Math.min(1, Math.max(0, o.detune ?? 0.6));
  const amount = SUPERSAW_DETUNE.reduce((a, k) => a * x + k, 0);
  const mix = Math.min(1, Math.max(0, o.mix ?? 0.75));
  const mid = 0.99785 - 0.55366 * mix;
  const side = -0.73764 * mix * mix + 1.2841 * mix + 0.044372;
  // Each side hears the centre saw and three side ones: hold its power whatever the mix
  const level = side / Math.sqrt(mid * mid + 3 * side * side);
  const S = stereo(ctx, c.out, { level, cut: keyCut(o.cut ?? 7000, f, 523), q: o.q ?? 0, hp: f });
  const end = amps(S, t, c.dur, vel * 0.2, o.attack ?? 0.003, 0.5, 0.7, o.release ?? 0.25);
  sweep(S, t, 1.5 * touch, 0.003, 0.15);
  const middle = centre(ctx, S, mid / side);
  const saws = [0, ...SUPERSAW].map((r, i) => {
    const s = vco(ctx, 'saw', f, t, end, 1200 * Math.log2(1 + r * amount), 1);
    s.connect(i ? S[i % 2].input : middle);
    applyBends(s.frequency, c, 1, o.glide ?? 0.08);
    return s;
  });
  vibrato(ctx, saws.map((s) => s.detune), t, end, 5.5, o.vib ?? 0, 0.25);
  unplug(saws[0], S.map((s) => s.out));
};

/**
 * Synth lead, a Minimoog-style monosynth voice: a saw in the centre and two more a few cents either side (left and right) over a square an octave
 * down, a four-pole low-pass whose envelope opens further the harder a note is played, a soft-clipping output stage, a slow analog drift, glide
 * and a delayed vibrato. o.cut (Hz around C5, default 3200), o.q (resonance dB, default 3), o.env (filter decay s, default 0.25), o.vib (cents, default 12), o.attack, o.release, o.glide.
 */
const synthLead: Voice = (c) => {
  const { ctx, t, f, vel, touch, o } = c;
  const S = stereo(ctx, c.out, { level: 0.3, cut: keyCut(o.cut ?? 3200, f, 523), q: o.q ?? 3, drive: 2 });
  const end = amps(S, t, c.dur, vel * 0.3, o.attack ?? 0.005, 0.3, 0.8, o.release ?? 0.12);
  sweep(S, t, 1 + 1.5 * touch, 0.004, o.env ?? 0.25);
  const middle = centre(ctx, S, 1.3);
  const oscs = [vco(ctx, 'saw', f, t, end), vco(ctx, 'square', f, t, end, -1200), vco(ctx, 'saw', f, t, end, -8), vco(ctx, 'saw', f, t, end, 8)];
  oscs[0].connect(middle);
  oscs[1].connect(gainNode(ctx, 0.4)).connect(middle);
  oscs[2].connect(S[0].input);
  oscs[3].connect(S[1].input);
  vibrato(ctx, oscs.map((s) => s.detune), t, end, 5.6, o.vib ?? 12, 0.3);
  vibrato(ctx, [oscs[2].detune, oscs[3].detune], t, end, 0.1 + Math.random() * 0.3, 3, 0);
  for (const s of oscs) applyBends(s.frequency, c, 1, o.glide ?? 0.06);
  unplug(oscs[0], S.map((s) => s.out));
};

/**
 * Pluck, the short bright notes of trance and house arpeggios: three saws (centre, a few cents flat left and sharp right) into a four-pole low-pass
 * whose envelope snaps shut, harder notes opening it further, and an amplifier that dies away with no sustain.
 * o.cut (Hz the filter closes to, around C5, default 500), o.env (filter decay s, default 0.1), o.q (resonance dB, default 5), o.release (default 0.3).
 */
const pluck: Voice = (c) => {
  const { ctx, t, f, vel, touch, o } = c;
  const S = stereo(ctx, c.out, { level: 0.35, cut: keyCut(o.cut ?? 500, f, 523, 0.8), q: o.q ?? 5 });
  const end = amps(S, t, c.dur, vel * 0.3, 0.002, 0.7, 0, o.release ?? 0.3);
  sweep(S, t, 2.5 + 2 * touch, 0.002, o.env ?? 0.1);
  const mid = vco(ctx, 'saw', f, t, end);
  mid.connect(centre(ctx, S, 1.3));
  vco(ctx, 'saw', f, t, end, -10).connect(S[0].input);
  vco(ctx, 'saw', f, t, end, 10).connect(S[1].input);
  unplug(mid, S.map((s) => s.out));
};

/**
 * Analog pad in the manner of a Juno-60: a saw in the centre and two more left and right whose pitch one slow triangle sweeps in opposite
 * directions (what the Juno's bucket-brigade chorus does to its delayed copies, about ±7 cents), into a four-pole low-pass that breathes
 * slowly around its cutoff. cut: the cutoff (Hz at middle C); sub: the level of a sine an octave down. o.cut, o.attack (default 0.9), o.release (default 1.2).
 */
function analogPad(cut: number, sub: number): Voice {
  return (c) => {
    const { ctx, t, f, vel, o } = c;
    const S = stereo(ctx, c.out, { level: 0.4, cut: keyCut(o.cut ?? cut, f, 262), q: 1 });
    const end = amps(S, t, c.dur, vel * 0.2, o.attack ?? 0.9, 0, 1, o.release ?? 1.2);
    const mid = vco(ctx, 'saw', f, t, end);
    mid.connect(centre(ctx, S, 1));
    unplug(mid, S.map((s) => s.out));
    const [left, right] = [vco(ctx, 'saw', f, t, end, -4), vco(ctx, 'saw', f, t, end, 4)];
    left.connect(S[0].input);
    right.connect(S[1].input);
    const chorus = osc(ctx, 'triangle', 0.5 + Math.random() * 0.4, t, end);
    chorus.connect(gainNode(ctx, 7)).connect(left.detune);
    chorus.connect(gainNode(ctx, -7)).connect(right.detune);
    // Breathing: the cutoff drifts a third of an octave either way
    const breath = gainNode(ctx, 400);
    osc(ctx, 'sine', 0.08 + Math.random() * 0.08, t, end).connect(breath);
    for (const s of S) for (const { detune } of s.lp) breath.connect(detune);
    if (sub) {
      const s = osc(ctx, 'sine', f / 2, t, end).connect(gainNode(ctx, sub * 0.4));
      for (const st of S) s.connect(st.amp);
    }
  };
}

/** Glass pad: a sine frequency-modulated by its octave, its brightness breathing slowly, and a shimmer two octaves up on the right */
const glassPad: Voice = (c) => {
  const { ctx, t, f, vel, o } = c;
  const g = gainNode(ctx, 0);
  const end = adsr(g, t, c.dur, vel * 0.16, o.attack ?? 0.9, 0, 1, o.release ?? 1.2);
  g.connect(c.out);
  const s = osc(ctx, 'sine', f, t, end);
  const m = osc(ctx, 'sine', f * 2.001, t, end);
  const mg = gainNode(ctx, f * 0.6);
  m.connect(mg).connect(s.frequency);
  const sh = osc(ctx, 'sine', f * 4, t, end, 6);
  s.connect(panned(ctx, g, -0.3));
  sh.connect(gainNode(ctx, 0.12)).connect(panned(ctx, g, 0.3));
  osc(ctx, 'sine', 0.18 + Math.random() * 0.1, t, end).connect(gainNode(ctx, f * 0.4)).connect(mg.gain);
  unplug(s, [g]);
};

/** Air pad: noise through narrow band-passes at the note and its octave, a different stretch of noise on each side */
const airPad: Voice = (c) => {
  const { ctx, t, f, vel, o } = c;
  for (const pan of [-1, 1]) {
    const g = gainNode(ctx, 0);
    const end = adsr(g, t, c.dur, vel * 0.64, o.attack ?? 0.9, 0, 1, o.release ?? 1.2);
    const side = panned(ctx, c.out, pan);
    g.connect(side);
    const n = noiseSrc(ctx, t, end);
    n.connect(filt(ctx, 'bandpass', f, 60)).connect(gainNode(ctx, 1.2)).connect(g);
    n.connect(filt(ctx, 'bandpass', f * 2, 60)).connect(gainNode(ctx, 0.5)).connect(g);
    unplug(n, [side]);
  }
};

/** Glass harmonica: two nearly unison sines beat against each other, slow attack */
const glass: Voice = (c) => {
  const { ctx, t, f, vel, o } = c;
  const g = gainNode(ctx, 0);
  const end = adsr(g, t, c.dur, vel * 0.22, o.attack ?? 0.18, 0.5, 0.7, o.release ?? 0.8);
  g.connect(c.out);
  const s = osc(ctx, 'sine', f, t, end);
  s.connect(panned(ctx, g, -0.25));
  osc(ctx, 'sine', f, t, end, 7).connect(panned(ctx, g, 0.25));
  osc(ctx, 'sine', f * 2, t, end, 3).connect(gainNode(ctx, 0.18)).connect(g);
  unplug(s, [g]);
};

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
  const saws = ([[1, -5], [1.5, 4], [2, 3], [1, 8]] as const).map(([ratio, det]) => osc(ctx, 'sawtooth', f * ratio, t, end, det));
  for (const s of saws) s.connect(pre);
  unplug(saws[0], [g]);
};

// ───────────────────────── Bass ─────────────────────────
//
// The synth basses are mono below 120 Hz (the reese's wide saws are high-passed above it, and a clean sine carries its bottom): a club system
// needs one centred low end, and a phone speaker sums the two sides anyway.

/** Fingerstyle bass: sine + triangle, a plucked-string low-pass envelope */
const fingerBass: Voice = (c) => {
  const { ctx, t, f, vel, o } = c;
  const g = gainNode(ctx, 0);
  const end = adsr(g, t, c.dur, vel * 0.5, 0.006, 0.6, 0.55, o.release ?? 0.08);
  const lp = filt(ctx, 'lowpass', 400, 1);
  lp.frequency.setValueAtTime(900 + vel * 900, t);
  lp.frequency.setTargetAtTime(350, t, 0.12);
  lp.connect(g).connect(c.out);
  const s = osc(ctx, 'sine', f, t, end);
  s.connect(lp);
  osc(ctx, 'triangle', f, t, end).connect(gainNode(ctx, 0.6)).connect(lp);
  osc(ctx, 'sawtooth', f, t, end).connect(gainNode(ctx, 0.12)).connect(lp);
  unplug(s, [g]);
};

/**
 * Synth bass, the off-beat bass of house and trance: two saws a few cents apart and a square through a four-pole low-pass whose envelope goes
 * "bwow" (harder notes open it further) and a soft clipper for weight, over a clean sine at the fundamental.
 * o.cut (Hz the filter settles to at C2, following the keyboard; default 180), o.q (resonance dB, default 6), o.env (filter decay s, default 0.08), o.release, o.glide.
 */
const synthBass: Voice = (c) => {
  const { ctx, t, f, vel, touch, o } = c;
  const S = [strip(ctx, c.out, { pan: 0, level: 0.35, cut: keyCut(o.cut ?? 180, f, 65.4, 1), q: o.q ?? 6, drive: 2 })];
  const end = amps(S, t, c.dur, vel * 0.5, 0.003, 0.3, 0.75, o.release ?? 0.06);
  sweep(S, t, 2 + 2 * touch, 0.003, o.env ?? 0.08);
  const oscs = [vco(ctx, 'saw', f, t, end, -6), vco(ctx, 'saw', f, t, end, 6), vco(ctx, 'square', f, t, end)];
  for (const s of oscs) s.connect(S[0].input);
  const sine = osc(ctx, 'sine', f, t, end);
  sine.connect(gainNode(ctx, 0.5)).connect(S[0].amp);
  for (const s of [...oscs, sine]) applyBends(s.frequency, c, 1, o.glide ?? 0.07);
  unplug(sine, [S[0].out]);
};

/**
 * Reese bass (after Kevin Saunderson's "Just Want Another Chance", 1988): saws detuned against each other, whose slowly drifting beats make the
 * note churn. A close pair in the centre and a wider pair left and right, through a four-pole low-pass, soft clipping and a high-pass that leaves
 * the bottom to a clean mono sine. o.detune (cents, default 16), o.cut (Hz, default 1600), o.q, o.attack, o.release, o.glide.
 */
const reese: Voice = (c) => {
  const { ctx, t, f, vel, o } = c;
  const d = o.detune ?? 16;
  const S = stereo(ctx, c.out, { level: 0.3, cut: o.cut ?? 1600, q: o.q ?? 2, drive: 2.5, hp: 160 });
  const end = amps(S, t, c.dur, vel * 0.5, o.attack ?? 0.01, 0.5, 0.85, o.release ?? 0.12);
  const middle = centre(ctx, S, 1);
  const saws = ([[-d / 3, middle], [d / 3, middle], [-d, S[0].input], [d, S[1].input]] as const).map(([cents, to]) => {
    const s = vco(ctx, 'saw', f, t, end, cents);
    s.connect(to);
    return s;
  });
  // The beats drift: one saw of each pair wanders by a third of the detune
  vibrato(ctx, [saws[0].detune, saws[2].detune], t, end, 0.15 + Math.random() * 0.2, d / 3, 0);
  const sub = osc(ctx, 'sine', f, t, end);
  const subLevel = gainNode(ctx, 0.6);
  sub.connect(subLevel);
  for (const s of S) subLevel.connect(s.amp);
  for (const s of [...saws, sub]) applyBends(s.frequency, c, 1, o.glide ?? 0.08);
  unplug(sub, S.map((s) => s.out));
};

/**
 * Acid bass (Roland TB-303): one saw (o.square = 1: a square) into a resonant low-pass swept down from every note, with no keyboard tracking.
 * An accented note (velocity above 0.9: ! in a melody) is louder and its sweep higher, shorter and rounded at the top (the 303's accent circuit),
 * which sets the resonance squealing; a glide (>) slides into the next note in about 60 ms without restarting the envelopes, like the 303's
 * Slide. Soft clipping on the output, as acid lines are usually overdriven, and the output's coupling high-pass.
 * o.cut (Hz, default 300), o.q (resonance dB, default 15), o.env (filter decay s, default 0.3), o.square, o.glide, o.release.
 */
const acid: Voice = (c) => {
  const { ctx, t, f, vel, touch, o } = c;
  const accent = touch > 0.9;
  const S = [strip(ctx, c.out, { pan: 0, level: 0.5, cut: o.cut ?? 300, q: o.q ?? 15, drive: 2.5, hp: 35 })];
  const end = amps(S, t, c.dur, vel * (accent ? 0.4 : 0.3), 0.003, 1.5, 0.5, o.release ?? 0.02);
  const dec = o.env ?? 0.3;
  sweep(S, t, accent ? 3.5 : 2.5, accent ? 0.03 : 0.003, accent ? Math.min(dec, 0.12) : dec);
  const s = vco(ctx, o.square ? 'square' : 'saw', f, t, end, 0, 1);
  s.connect(S[0].input);
  applyBends(s.frequency, c, 1, o.glide ?? 0.06);
  unplug(s, [S[0].out]);
};

/**
 * 808 bass: the Roland TR-808 bass drum played as a tuned bass, as in trap and future bass. A sine that starts an octave high and drops to pitch
 * in about 40 ms (the punch), then a long slow decay, driven into a soft clipper whose third harmonic carries it on small speakers and fades as
 * the note decays. Mono, with nothing below the fundamental. o.drive (default 2; 0.5 is nearly clean), o.glide (default 0.12), o.release.
 */
const bass808: Voice = (c) => {
  const { ctx, t, f, vel, o } = c;
  const env = gainNode(ctx, 0);
  const end = adsr(env, t, c.dur, 1, 0.002, 2.5, 0.3, o.release ?? 0.15);
  const s = osc(ctx, 'sine', 2 * f, t, end);
  s.frequency.setTargetAtTime(f, t, 0.012);
  applyBends(s.frequency, c, 1, o.glide ?? 0.12);
  const out = gainNode(ctx, vel * 0.5);
  s.connect(env).connect(saturator(ctx, o.drive ?? 2)).connect(out).connect(c.out);
  unplug(s, [out]);
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
  unplug(s, [g]);
};

/** Distorted bass: two saws and a square an octave down, overdriven, then a four-pole low-pass; a clean sine an octave down under it. o.cut (Hz, default 1400), o.q, o.release, o.glide */
const distBass: Voice = (c) => {
  const { ctx, t, f, vel, o } = c;
  const S = [strip(ctx, c.out, { pan: 0, level: 1, cut: o.cut ?? 1400, q: o.q ?? 2 })];
  const end = amps(S, t, c.dur, vel * 0.26, 0.005, 0.3, 0.8, o.release ?? 0.06);
  const pre = gainNode(ctx, 0.45);
  pre.connect(saturator(ctx, 4)).connect(S[0].input);
  const oscs = [vco(ctx, 'saw', f, t, end, -6), vco(ctx, 'saw', f, t, end, 6), vco(ctx, 'square', f, t, end, -1200)];
  for (const s of oscs) s.connect(pre);
  const sine = osc(ctx, 'sine', f / 2, t, end);
  sine.connect(gainNode(ctx, 0.6)).connect(S[0].amp);
  for (const s of oscs) applyBends(s.frequency, c, 1, o.glide ?? 0.07);
  applyBends(sine.frequency, c, 0.5, o.glide ?? 0.07);
  unplug(sine, [S[0].out]);
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



/**
 * White noise swept from `from` to `to` Hz over [t, end], each side of the stereo field its own noise: a high-pass under a rising sweep,
 * a low-pass over a falling one, resonant so that it whistles at the edge of the sweep
 */
function noiseSweep(ctx: BaseAudioContext, out: AudioNode, t: number, end: number, from: number, to: number): void {
  for (const side of [-0.8, 0.8]) {
    const f = filt(ctx, to > from ? 'highpass' : 'lowpass', from, 4);
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, end);
    noiseSrc(ctx, t, end + 0.05).connect(f).connect(panned(ctx, out, side));
  }
}

/**
 * Riser (uplifter) for a build-up: wide white noise through a resonant high-pass sweeping up (params from → to, Hz), and a detuned sawtooth
 * stack climbing two octaves to an octave above the note under an opening low-pass. It swells to its peak as the note ends and stops dead,
 * leaving the first beat of the drop clear
 */
const riser: Voice = (c) => {
  const { ctx, t, f, vel, o } = c;
  const end = t + c.dur;
  const g = gainNode(ctx, 0);
  g.gain.setValueAtTime(vel * 0.008, t);
  g.gain.exponentialRampToValueAtTime(vel * 0.25, end);
  g.gain.linearRampToValueAtTime(0, end + 0.02);
  g.connect(c.out);
  noiseSweep(ctx, g, t, end, o.from ?? 260, o.to ?? 7000);
  const lp = filt(ctx, 'lowpass', 500, 1);
  lp.frequency.setValueAtTime(500, t);
  lp.frequency.exponentialRampToValueAtTime(9000, end);
  lp.connect(gainNode(ctx, 0.1)).connect(g);
  // An unpitched part (a rhythm) climbs to C5
  const top = f > 20 ? f * 2 : 523;
  for (const cents of [-15, 0, 15]) {
    const s = osc(ctx, 'sawtooth', top / 4, t, end + 0.05, cents);
    s.frequency.exponentialRampToValueAtTime(top, end);
    s.connect(lp);
  }
};

/** Downlifter, the riser in reverse, for the bars after a drop or into a breakdown: wide white noise under a resonant low-pass sweeping down (params from → to, Hz) as it fades away */
const downlifter: Voice = (c) => {
  const { ctx, t, vel, o } = c;
  const end = t + c.dur;
  const g = gainNode(ctx, 0);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel * 0.3, t + 0.01);
  g.gain.exponentialRampToValueAtTime(vel * 3e-3, end);
  g.gain.linearRampToValueAtTime(0, end + 0.02);
  g.connect(c.out);
  noiseSweep(ctx, g, t, end, o.from ?? 9000, o.to ?? 150);
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
  warmPad: analogPad(1300, 0),
  glassPad,
  /** Dark pad: the analog pad nearly closed, over a sine an octave down */
  darkPad: analogPad(700, 0.6),
  airPad,
  glass,
  supersaw,
  synthLead,
  pluck,
  powerGtr,
  muteGtr: (c) => powerGtr({ ...c, o: { mute: 1, ...c.o } }),
  bass: fingerBass,
  synthBass,
  reese,
  acid,
  bass808,
  sub: subBass,
  distBass,
  birds,
  riser,
  downlifter,
} satisfies Record<string, Voice>;
