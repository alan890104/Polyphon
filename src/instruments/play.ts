// Play one note on any instrument: a cached sample, a bowed sample with a looping sustain, or a live voice.

import { midiToFrequency, type SampledInstrument } from './definition.ts';
import { getInstrument } from './registry.ts';
import { getSample, hasSample, loopOf, sampleMidi } from './samples.ts';

export interface NoteCall {
  ctx: BaseAudioContext;
  out: AudioNode;
  /** Start time (context seconds) */
  t: number;
  /** Held length (seconds) */
  dur: number;
  /** MIDI pitch (0 for unpitched drums) */
  m: number;
  /** 0-1 */
  vel: number;
  /** Glides: [seconds after the start, target MIDI pitch] */
  bends?: [number, number][];
  /** The track's instrument parameters */
  params?: Readonly<Record<string, number>>;
}

/** Play one note */
export function playNote(name: string, c: NoteCall): void {
  const def = getInstrument(name);
  const amp = Math.pow(c.vel, 1.4) * def.level;
  if (def.kind === 'live') {
    def.voice({ ctx: c.ctx, out: c.out, t: c.t, dur: c.dur, f: midiToFrequency(c.m), vel: amp, bends: c.bends?.map(([at, m]) => [at, midiToFrequency(m)]), o: c.params ?? {} });
    return;
  }
  if (def.bow) {
    playBow(def, name, c, amp);
    return;
  }
  const variant = Math.floor(Math.random() * (def.variants ?? 1));
  const b = getSample(c.ctx, def, name, c.m, variant);
  const src = c.ctx.createBufferSource();
  src.buffer = b;
  // A fixed-pitch drum given a different note is tuned by changing the playback rate (taiko, tom and others are already rendered by pitch and never reach here)
  if (def.fixed !== undefined && c.m && c.m !== def.fixed && (c.params?.tune ?? 0) > 0) src.playbackRate.value = Math.pow(2, (c.m - def.fixed) / 12);
  const g = c.ctx.createGain();
  if (def.loop) {
    src.loop = true;
    const a = c.params?.attack ?? 1.5;
    const r = c.params?.release ?? 1.5;
    g.gain.setValueAtTime(0, c.t);
    g.gain.linearRampToValueAtTime(amp, c.t + a);
    g.gain.setValueAtTime(amp, c.t + Math.max(a, c.dur));
    g.gain.linearRampToValueAtTime(0, c.t + Math.max(a, c.dur) + r);
    src.connect(g).connect(c.out);
    src.start(c.t, (c.t * 7.3) % b.duration);
    src.stop(c.t + Math.max(a, c.dur) + r + 0.05);
    return;
  }
  g.gain.value = amp;
  if (def.tone) {
    const lp = c.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(c.ctx.sampleRate * 0.45, def.tone(c.m, c.vel));
    // The Web Audio low-pass Q is the resonance in decibels: -3 dB is roughly Butterworth, with no nasal tone
    lp.Q.value = -3;
    src.connect(lp).connect(g).connect(c.out);
  } else src.connect(g).connect(c.out);
  src.start(c.t);
  const r = c.params?.release ?? def.damper?.(c.m) ?? def.release ?? 0.2;
  if (def.hold === 'damp' && !(c.params?.ring ?? 0) && r !== Infinity) {
    const off = c.t + Math.max(def.minHold ?? 0.03, c.dur);
    g.gain.setValueAtTime(amp, off);
    g.gain.setTargetAtTime(1e-4, off, r / 4);
    src.stop(Math.min(off + r * 1.5, c.t + b.duration));
  } else src.stop(c.t + b.duration);
}

/** Bowed strings: pick the soft or hard layer, make up pitch with a rate change, loop the sustain section, and lift the bow when the note ends */
function playBow(def: SampledInstrument, name: string, c: NoteCall, amp: number): void {
  const bw = def.bow!;
  const o = c.params ?? {};
  let loud = c.vel * (o.bright ?? 1) > bw.loudAt ? 1 : 0;
  const root = sampleMidi(def, c.m);
  // If this layer is not prepared but the other one is: use the other for now, rather than rendering during playback (that would stall)
  if (!hasSample(c.ctx.sampleRate, def, name, c.m, loud) && hasSample(c.ctx.sampleRate, def, name, c.m, 1 - loud)) loud = 1 - loud;
  const b = getSample(c.ctx, def, name, c.m, loud);
  const src = c.ctx.createBufferSource();
  src.buffer = b;
  const lp = loopOf(b);
  if (lp) {
    src.loop = true;
    src.loopStart = lp[0];
    src.loopEnd = lp[1];
  }
  const rate = src.playbackRate;
  rate.setValueAtTime(Math.pow(2, (c.m - root) / 12), c.t);
  const glide = o.glide ?? bw.glide;
  if (c.bends) for (const [at, m] of c.bends) rate.setTargetAtTime(Math.pow(2, (m - root) / 12), c.t + at, glide / 3);
  const a = Math.max(0.005, o.attack ?? bw.attack);
  const r = o.release ?? bw.release;
  const off = c.t + Math.max(c.dur, 0.06);
  const g = c.ctx.createGain();
  const p = g.gain;
  p.setValueAtTime(0, c.t);
  p.linearRampToValueAtTime(amp, c.t + Math.min(a, Math.max(0.005, off - c.t)));
  p.setValueAtTime(amp, off);
  p.setTargetAtTime(1e-4, off, r / 4);
  src.connect(g).connect(c.out);
  src.start(c.t);
  src.stop(off + r * 1.6 + 0.02);
}
