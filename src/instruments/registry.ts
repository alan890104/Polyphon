// The instrument registry: every name a track can use, built-in or registered by the application.

import { BUILT_IN, type BuiltInInstrument } from './builtin.ts';
import type { InstrumentDef } from './definition.ts';
import { forgetSamples } from './samples.ts';

/** An instrument name. Built-in names autocomplete; any registered name is accepted too. */
export type InstrumentName = BuiltInInstrument | (string & {});

/** One note handed to a custom synthesized instrument */
export interface SynthNote {
  context: BaseAudioContext;
  /** Connect the note's output here */
  destination: AudioNode;
  /** Start time (context seconds) */
  time: number;
  /** How long the note is held (seconds); the release comes after this */
  duration: number;
  /** Frequency (Hz) */
  frequency: number;
  /** Loudness 0-1, already shaped by the instrument's level */
  velocity: number;
  /** Glides: [seconds after the start, target frequency in Hz] */
  glides: [number, number][];
  /** The track's `params`, for instrument-specific settings */
  params: Readonly<Record<string, number>>;
}

/** A custom instrument rendered offline, once per pitch, then played back from a buffer */
export interface CustomSampledInstrument {
  /** Render one note: mono, or [left, right] */
  render(sampleRate: number, midi: number): Float32Array | [Float32Array, Float32Array];
  /** 'ring' (default) plays the whole sample; 'damp' fades it out `release` seconds after the note ends */
  sustain?: 'ring' | 'damp';
  /** Release time in seconds for 'damp' (default 0.2) */
  release?: number;
  /** Output level (default 1) */
  level?: number;
}

/** A custom instrument synthesized live, note by note */
export interface CustomSynthInstrument {
  /** Build the Web Audio graph for one note */
  play(note: SynthNote): void;
  /** Output level (default 1) */
  level?: number;
  /** Supports glides between notes (the `>` marker in a melody) */
  glide?: boolean;
}

export type CustomInstrument = CustomSampledInstrument | CustomSynthInstrument;

const registry = new Map<string, InstrumentDef>(Object.entries(BUILT_IN));

/**
 * Add an instrument (or replace one) under a name tracks can use.
 *
 * @example
 * registerInstrument('beep', {
 *   play({ context, destination, time, duration, frequency, velocity }) {
 *     const osc = new OscillatorNode(context, { type: 'square', frequency });
 *     const amp = new GainNode(context, { gain: velocity * 0.2 });
 *     osc.connect(amp).connect(destination);
 *     osc.start(time);
 *     osc.stop(time + duration);
 *   },
 * });
 */
export function registerInstrument(name: string, instrument: CustomInstrument): void {
  forgetSamples(name);
  if ('play' in instrument) {
    registry.set(name, {
      kind: 'live',
      level: instrument.level ?? 1,
      glide: instrument.glide ?? false,
      voice: (c) =>
        instrument.play({ context: c.ctx, destination: c.out, time: c.t, duration: c.dur, frequency: c.f, velocity: c.vel, glides: c.bends ?? [], params: c.o }),
    });
  } else {
    registry.set(name, {
      kind: 'sample',
      render: (sampleRate, midi) => instrument.render(sampleRate, midi),
      hold: instrument.sustain ?? 'ring',
      release: instrument.release ?? 0.2,
      level: instrument.level ?? 1,
    });
  }
}

/** Every instrument name currently available */
export function instrumentNames(): string[] {
  return [...registry.keys()];
}

/** Look up an instrument; throws a helpful error for unknown names */
export function getInstrument(name: string): InstrumentDef {
  const def = registry.get(name);
  if (!def) throw new Error(`Unknown instrument "${name}". Available: ${instrumentNames().join(', ')}`);
  return def;
}
