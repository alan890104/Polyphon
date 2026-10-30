// The data every notation function produces: a Part is a list of notes on a grid of sixteenth-note steps.
// It is plain data, so any code that returns { notes, duration } can feed a track.

/** One note (or chord) in a part. Times are in steps: one step is a sixteenth note. */
export interface Note {
  /** Start, in steps from the start of the part */
  time: number;
  /** Length, in steps */
  duration: number;
  /** MIDI pitches sounding together; unpitched drums may leave this empty */
  pitches: number[];
  /** Loudness 0-1 */
  velocity: number;
  /** Glide into the next note (instruments that support glides) */
  glide?: boolean;
  /** Strum a chord: delay in seconds between successive pitches */
  strum?: number;
}

export interface Part {
  notes: Note[];
  /** Total length, in steps */
  duration: number;
}

/**
 * A time signature, or the number of sixteenth-note steps in one bar.
 * '4/4' = 16, '3/4' = 12, '6/8' = 12, '7/8' = 14, '5/4' = 20.
 */
export type Meter = number | `${number}/${number}`;

/** Steps in one bar of a meter (default 4/4 = 16) */
export function stepsPerBar(meter: Meter = 16): number {
  if (typeof meter === 'number') return meter;
  const [beats, unit] = meter.split('/').map(Number);
  const steps = (beats * 16) / unit;
  if (!(steps > 0) || !Number.isFinite(steps)) throw new Error(`Invalid meter: ${meter}`);
  return steps;
}

/** Velocities for the three dynamics the notation can write */
export const VELOCITY = { normal: 0.78, accent: 1, ghost: 0.42 } as const;
