// How an instrument is described internally. Two kinds:
//   sample: every note is rendered offline once (DSP in dsp/ and bowed.ts), cached, and played back as a buffer;
//   live:   every note builds a small Web Audio graph at play time (voices.ts), for sustained and gliding sounds.

import type { Bowed, BowInst } from './bowed.ts';
import type { Voice } from './voices.ts';

/** Render one note: sample rate, MIDI pitch, variant index → mono, stereo, or a bowed sample with a loop section */
export type Render = (sampleRate: number, midi: number, variant: number) => Float32Array | [Float32Array, Float32Array] | Bowed;

export interface SampledInstrument {
  kind: 'sample';
  render: Render;
  /** ring: the sample rings out naturally; damp: closed off with release seconds when the note ends */
  hold: 'ring' | 'damp';
  release?: number;
  level: number;
  /** Number of random variants (so drums do not sound machine-gunned) */
  variants?: number;
  /** Drums that do not follow pitch: always render the sample with this note */
  fixed?: number;
  /** Ambience: loops, the note length is the duration (attack / release come from params.attack / release) */
  loop?: boolean;
  /** Minimum time a damp instrument rings (seconds): a note cut too short sounds electronic */
  minHold?: number;
  /** Bowed strings: one sample every few semitones (soft and hard layers), the sustain section loops, and pitch is made up with a rate change */
  bow?: BowInst & { name: string };
  /** Velocity determines timbre: the low-pass cutoff (Hz) for this note and velocity. The sample is the brightest strike; a light touch rolls off the highs */
  tone?: (midi: number, velocity: number) => number;
  /** Damping time by pitch (seconds); Infinity means no damper, so the string rings on even after release (the piano's highest strings) */
  damper?: (midi: number) => number;
  /** After the damper: a faint ring (linear level, and seconds to fade) from the soundboard and the undamped strings */
  afterRing?: [level: number, seconds: number];
  /** Stereo width across the keyboard: low notes left, high notes right (0-1), as heard from the player's seat */
  spread?: number;
  /** Supports glides between notes (the `>` marker in a melody) */
  glide?: boolean;
  /** Choke group: a note cuts off the one still ringing in its group, as a drum machine's closed hi-hat cuts off its open one */
  choke?: string;
}

export interface LiveInstrument {
  kind: 'live';
  voice: Voice;
  level: number;
  /** Supports glides between notes (the `>` marker in a melody) */
  glide?: boolean;
}

export type InstrumentDef = SampledInstrument | LiveInstrument;

export const midiToFrequency = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);
