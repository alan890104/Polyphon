// A song is plain data: tempo, the room it plays in, and tracks that pair an instrument with a part.

import type { Room } from './instruments/dsp/reverb.ts';
import type { InstrumentName } from './instruments/registry.ts';
import { melody } from './notation/melody.ts';
import { stepsPerBar, type Meter, type Part } from './notation/part.ts';

export interface Song {
  title: string;
  /** One line on the mood and the instrumentation */
  description?: string;
  /** Beats (quarter notes) per minute */
  bpm: number;
  /** Time signature (default '4/4') */
  meter?: Meter;
  /** Eighth-note swing 0-0.5 (0.33 is roughly a triplet feel) */
  swing?: number;
  /** Sixteenth-note swing 0-0.5 */
  swing16?: number;
  /** The room (default: a medium hall) */
  reverb?: Reverb;
  /** A tempo-synced stereo ping-pong delay that tracks can send to */
  delay?: Delay;
  /** Level of the whole song (linear, default 1) */
  gain?: number;
  /** Mastering EQ */
  master?: MasterEq;
  /** Plays once before the tracks start looping */
  intro?: Track[];
  /** The body of the song; loops unless `loop` is false */
  tracks: Track[];
  /** false: play the body once and end (jingles, fanfares). Default true */
  loop?: boolean;
}

export interface Track {
  /** Shown in mixers; defaults to the instrument name */
  name?: string;
  instrument: InstrumentName;
  /** The notes: a part, or a melody string read in the song's meter */
  part: Part | string;
  /** Level (linear, default 1) */
  gain?: number;
  /** -1 left to 1 right */
  pan?: number;
  /** How much goes to the reverb, 0-1 (default 0.25) */
  reverb?: number;
  /** How much goes to the delay, 0-1 (default 0) */
  delay?: number;
  /** Semitones */
  transpose?: number;
  /** Timing looseness: the most a note may land early or late, in seconds (default 0.008, drums 0.003) */
  humanize?: number;
  /** Instrument settings, such as attack, release, bright, glide */
  params?: Record<string, number>;
  /** false: play once at the start of the section instead of repeating to fill it. Default true */
  repeat?: boolean;
}

export interface Reverb extends Room {
  /** Level of the reverb return (default 1) */
  mix?: number;
}

export interface Delay {
  /** Delay time, in sixteenth-note steps */
  steps: number;
  /** Echo feedback 0-1 (default 0.35) */
  feedback?: number;
  /** Low-pass on the echoes, Hz (default 2800) */
  tone?: number;
  /** Level of the delay return (default 0.8) */
  mix?: number;
}

/** Mastering EQ: warm adds body at 150 Hz (dB), cut pulls 1.3 kHz down (dB), trim sets the final level (dB) */
export interface MasterEq {
  warm?: number;
  cut?: number;
  trim?: number;
}

export const DEFAULT_REVERB: Reverb = { size: 1.8, damp: 0.45 };

/**
 * Declare a song. It returns the song unchanged; it exists so editors can type-check and autocomplete it.
 *
 * @example
 * export default defineSong({
 *   title: 'Morning Market',
 *   bpm: 112,
 *   tracks: [
 *     { instrument: 'marimba', part: 'C5:2 E5 G5 E5 | D5:4 B4:4 G4:8 |' },
 *     { instrument: 'pizzBass', part: bassline(chords('C | G'), 'x...x...x...x...', '1 5') },
 *   ],
 * });
 */
export function defineSong(song: Song): Song {
  return song;
}

/** The part a track plays (melody strings are read in the song's meter) */
export function trackPart(track: Track, meter: Meter): Part {
  return typeof track.part === 'string' ? melody(track.part, meter) : track.part;
}

/** Length of one section: its longest track, rounded up to whole bars (at least one bar) */
export function sectionSteps(tracks: Track[], meter: Meter): number {
  const bar = stepsPerBar(meter);
  const longest = Math.max(bar, ...tracks.map((t) => trackPart(t, meter).duration));
  return Math.ceil(longest / bar - 1e-6) * bar;
}

/** How long the intro and one pass of the body last, in seconds */
export function songDuration(song: Song): { intro: number; loop: number } {
  const step = 60 / song.bpm / 4;
  const meter = song.meter ?? 16;
  return {
    intro: song.intro?.length ? sectionSteps(song.intro, meter) * step : 0,
    loop: sectionSteps(song.tracks, meter) * step,
  };
}
