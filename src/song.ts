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
  /** Mastering: EQ, glue compression and, for loud genres, a limiter */
  master?: Master;
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
  /** Duck under another track's hits, the pumping of house and EDM: that track's name (usually 'Kick'), or how deep and how long too */
  duck?: string | Duck;
  /** Low-pass filter: a cutoff in Hz, or a sweep */
  lowpass?: number | Sweep;
  /** High-pass filter: a cutoff in Hz, or a sweep */
  highpass?: number | Sweep;
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

/** Sidechain pumping: at every hit of another track (usually the kick) the level dips, then swells back */
export interface Duck {
  /** The name of the track whose hits duck this one, in the same section (it pumps even while that track is muted) */
  by: string;
  /** How far the level dips, 0-1 (default 0.7) */
  depth?: number;
  /** Steps until it is back up (default 4: a beat) */
  release?: number;
}

/**
 * A filter sweep, { step: Hz }, counted from the start of the section: the cutoff glides from one to the next (evenly in pitch) and
 * holds before the first and after the last. `{ 0: 400, 128: 400, 256: 18000 }` stays dark for eight bars, then opens over eight more.
 */
export type Sweep = Record<number, number>;

export interface Master {
  /** Body at 150 Hz, dB */
  warm?: number;
  /** Pulls 1.3 kHz down, dB */
  cut?: number;
  /** Level of the mix, dB */
  trim?: number;
  /** Bus compression that glues the mix together, 0-1 (0.3 gentle, 0.6 firm) */
  glue?: number;
  /** Master loud: dB pushed into a brickwall limiter that keeps the peaks under -1 dBFS, between the samples too (EDM: about 6-10). The song then bypasses the gentle limiter other songs share */
  loud?: number;
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

/** A track's name: its own, or its instrument's */
export function trackName(track: Track): string {
  return track.name ?? track.instrument;
}

/** The part a track plays (melody strings are read in the song's meter) */
export function trackPart(track: Track, meter: Meter): Part {
  return typeof track.part === 'string' ? melody(track.part, meter) : track.part;
}

/** Length of a section whose tracks have these parts: the longest, rounded up to whole bars (at least one bar) */
export function sectionSteps(parts: Part[], meter: Meter): number {
  const bar = stepsPerBar(meter);
  const longest = Math.max(bar, ...parts.map((p) => p.duration));
  return Math.ceil(longest / bar - 1e-6) * bar;
}

/** How long the intro and one pass of the body last, in seconds */
export function songDuration(song: Song): { intro: number; loop: number } {
  const step = 60 / song.bpm / 4;
  const meter = song.meter ?? 16;
  const steps = (tracks: Track[]) => sectionSteps(tracks.map((t) => trackPart(t, meter)), meter);
  return { intro: song.intro?.length ? steps(song.intro) * step : 0, loop: steps(song.tracks) * step };
}
