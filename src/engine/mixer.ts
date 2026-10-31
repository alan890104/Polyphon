// Each song brings its own mixing console: per-track level, filters, ducking, pan and effect sends, a convolution reverb, a ping-pong delay
// and the mastering (EQ, glue compression, and a limiter of its own for songs mastered loud).
//
//   track input ── filters ── duck ─┬─ pan ───────────────────────┐
//                                   ├─ reverb send ── reverb ─────┤
//                                   └─ delay send ─── delay ──────┼── master ── EQ ── glue ── (loud stage) ── output
//                                                       └→ reverb │

import { impulse, type Room } from '../instruments/dsp/reverb.ts';
import { DEFAULT_REVERB, type Song, type Track } from '../song.ts';
import { breakpoints, cutoffAt, type Pump } from './automation.ts';
import { createLoudStage } from './output.ts';

export interface Mixer {
  /** The song's output (its fades are applied here) */
  output: GainNode;
  /** One strip per track, per section: [intro tracks, body tracks] */
  strips: [Strip[], Strip[]];
}

/** A track's channel on the console */
export interface Strip {
  /** Where its notes go: the track's level (and mute) */
  input: GainNode;
  /** After its filters and ducking, before pan and effects */
  output: AudioNode;
  /** Its duck gain, when it ducks under another track */
  pump?: Pump;
  /** Its filters' cutoffs that sweep, with their breakpoints */
  sweeps: { cutoff: AudioParam; points: [number, number][] }[];
}

/** Q of the two stages of a 24 dB/octave filter, in dB as Web Audio reads it for low- and high-pass: Butterworth, with a touch of resonance */
const FILTER_Q = [-5.3, 4];

export function createMixer(ctx: BaseAudioContext, song: Song, stepSeconds: number, destination: AudioNode): Mixer {
  const output = ctx.createGain();
  output.connect(destination);
  const master = createMaster(ctx, song, output);
  const reverb = createReverb(ctx, song, master);
  const delay = song.delay ? createDelay(ctx, song.delay, stepSeconds, master, reverb) : null;
  const strip = (track: Track): Strip => {
    const input = ctx.createGain();
    input.gain.value = track.gain ?? 1;
    let out: AudioNode = input;
    const sweeps: Strip['sweeps'] = [];
    for (const type of ['lowpass', 'highpass'] as const) {
      const setting = track[type];
      if (setting === undefined) continue;
      const points = breakpoints(typeof setting === 'number' ? { 0: setting } : setting);
      for (const q of FILTER_Q) {
        const f = biquad(ctx, type, cutoffAt(points, 0), q);
        out = out.connect(f);
        if (points.length > 1) sweeps.push({ cutoff: f.frequency, points });
      }
    }
    let pump: Pump | undefined;
    if (track.duck) {
      const duck = ctx.createGain();
      out = out.connect(duck);
      const { depth = 0.7, release = 4 } = typeof track.duck === 'string' ? {} : track.duck;
      pump = { gain: duck.gain, depth, release: release * stepSeconds };
    }
    const pan = ctx.createStereoPanner();
    pan.pan.value = track.pan ?? 0;
    out.connect(pan).connect(master);
    send(ctx, out, reverb, track.reverb ?? 0.25);
    if (delay && track.delay) send(ctx, out, delay, track.delay);
    return { input, output: out, pump, sweeps };
  };
  return { output, strips: [(song.intro ?? []).map(strip), song.tracks.map(strip)] };
}

function send(ctx: BaseAudioContext, from: AudioNode, to: AudioNode, amount: number): void {
  const g = ctx.createGain();
  g.gain.value = amount;
  from.connect(g).connect(to);
}

/** Master bus: overall level, then (each only when asked for) the mastering EQ, glue compression and the loud stage */
function createMaster(ctx: BaseAudioContext, song: Song, output: AudioNode): GainNode {
  const master = ctx.createGain();
  const m = song.master ?? {};
  master.gain.value = (song.gain ?? 1) * Math.pow(10, (m.trim ?? 0) / 20);
  let out: AudioNode = master;
  if (m.warm || m.cut) {
    // Cut the rumble below 30 Hz first, so adding body does not eat the dynamics
    const hp = biquad(ctx, 'highpass', 30, 0.6);
    const warm = biquad(ctx, 'peaking', 150, 0.7, m.warm ?? 0);
    const cut = biquad(ctx, 'peaking', 1300, 0.9, -(m.cut ?? 0));
    out = out.connect(hp).connect(warm).connect(cut);
  }
  // Glue: the more of it, the lower the threshold and the higher the ratio; the slow attack lets the drums' hits through
  if (m.glue) out = out.connect(new DynamicsCompressorNode(ctx, { threshold: -4 - 12 * m.glue, knee: 6, ratio: 2 + 2 * m.glue, attack: 0.02, release: 0.25 }));
  out.connect(m.loud === undefined ? output : createLoudStage(ctx, m.loud, output));
  return master;
}

function biquad(ctx: BaseAudioContext, type: BiquadFilterType, frequency: number, q: number, gain = 0): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequency;
  f.Q.value = q;
  f.gain.value = gain;
  return f;
}

/** Convolution reverb with the song's room; returns its input */
function createReverb(ctx: BaseAudioContext, song: Song, master: AudioNode): ConvolverNode {
  const room = song.reverb ?? DEFAULT_REVERB;
  const rev = ctx.createConvolver();
  rev.normalize = false;
  rev.buffer = impulseBuffer(ctx, room);
  const ret = ctx.createGain();
  ret.gain.value = room.mix ?? 1;
  rev.connect(ret).connect(master);
  return rev;
}

/** Tempo-synced ping-pong delay (left, then right); its echoes also feed a little into the reverb. Returns its input */
function createDelay(ctx: BaseAudioContext, d: NonNullable<Song['delay']>, stepSeconds: number, master: AudioNode, reverb: AudioNode): GainNode {
  const time = Math.min(1.9, d.steps * stepSeconds);
  const input = ctx.createGain();
  const left = ctx.createDelay(2);
  const right = ctx.createDelay(2);
  left.delayTime.value = time;
  right.delayTime.value = time;
  const tone = biquad(ctx, 'lowpass', d.tone ?? 2800, 1);
  const feedback = ctx.createGain();
  feedback.gain.value = d.feedback ?? 0.35;
  const ret = ctx.createGain();
  ret.gain.value = d.mix ?? 0.8;
  const panL = ctx.createStereoPanner();
  const panR = ctx.createStereoPanner();
  panL.pan.value = -0.7;
  panR.pan.value = 0.7;
  input.connect(tone).connect(left);
  left.connect(panL).connect(ret);
  left.connect(right);
  right.connect(panR).connect(ret);
  right.connect(feedback).connect(left);
  ret.connect(master);
  send(ctx, ret, reverb, 0.3);
  return input;
}

const irCache = new Map<string, AudioBuffer>();
/** Impulse response of a room (each room is computed once per sample rate) */
export function impulseBuffer(ctx: BaseAudioContext, room: Room): AudioBuffer {
  const key = `${ctx.sampleRate}|${room.size}|${room.damp}|${room.preDelay}|${room.early}|${room.bloom}`;
  let b = irCache.get(key);
  if (!b) {
    const [l, r] = impulse(ctx.sampleRate, room);
    b = ctx.createBuffer(2, l.length, ctx.sampleRate);
    b.getChannelData(0).set(l);
    b.getChannelData(1).set(r);
    irCache.set(key, b);
  }
  return b;
}
