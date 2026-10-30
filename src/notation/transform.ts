// Combine and reshape parts. Every function returns a new part; nothing is modified in place.

import { melody } from './melody.ts';
import { stepsPerBar, type Meter, type Note, type Part } from './part.ts';

const asPart = (p: Part | string): Part => (typeof p === 'string' ? melody(p) : p);

/** Play parts one after another (strings are read as 4/4 melodies) */
export function sequence(...parts: (Part | string)[]): Part {
  const notes: Note[] = [];
  let t = 0;
  for (const p of parts.map(asPart)) {
    for (const n of p.notes) notes.push({ ...n, time: n.time + t });
    t += p.duration;
  }
  return { notes, duration: t };
}

/** Play parts at the same time; the result is as long as the longest */
export function stack(...parts: Part[]): Part {
  return { notes: parts.flatMap((p) => p.notes).sort((a, b) => a.time - b.time), duration: Math.max(0, ...parts.map((p) => p.duration)) };
}

/** Play a part n times in a row */
export function repeat(part: Part, times: number): Part {
  return sequence(...Array<Part>(times).fill(part));
}

/** Silence for a number of bars */
export const rest = (bars: number, meter: Meter = 16): Part => ({ notes: [], duration: bars * stepsPerBar(meter) });

/** Shift every pitch by a number of semitones */
export function transpose(part: Part, semitones: number): Part {
  return mapPitch(part, (m) => m + semitones);
}

/** Rewrite every pitch (for mode changes, inversions and so on) */
export function mapPitch(part: Part, fn: (midi: number) => number): Part {
  return { notes: part.notes.map((n) => ({ ...n, pitches: n.pitches.map(fn) })), duration: part.duration };
}

/** Multiply every velocity (0.5 = half as loud; capped at 1) */
export function scaleVelocity(part: Part, factor: number): Part {
  return { notes: part.notes.map((n) => ({ ...n, velocity: Math.min(1, n.velocity * factor) })), duration: part.duration };
}

/** Cut out the steps [from, to); notes that run past the end are shortened */
export function slice(part: Part, from: number, to: number): Part {
  return {
    notes: part.notes.filter((n) => n.time >= from && n.time < to).map((n) => ({ ...n, time: n.time - from, duration: Math.min(n.duration, to - n.time) })),
    duration: to - from,
  };
}
