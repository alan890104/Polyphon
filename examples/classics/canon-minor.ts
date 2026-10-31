// Pachelbel's Canon moved into D minor, written as a transformation of the original rather than a copy: every note is kept, and the
// ones the minor key changes come down a semitone. The ground's chords D A Bm F#m G D G A become Dm A Bb F Gm Dm Gm A: F# turns into
// F throughout, and B and C# into Bb and C, except over the A chord, which stays major (as in harmonic minor) so each pass still leads home.

import { defineSong, melody, type Part, type Track } from 'polyphon';
import canon from './canon.ts';

/** Over the A chord: the ground has one chord a beat (4 steps), eight to its two bars, and A is the second and the last */
const overA = (step: number) => [1, 7].includes(Math.floor(step / 4) % 8);

/** A pitch in D minor, under the chord at that step */
function lower(m: number, step: number): number {
  const pc = m % 12;
  if (pc === 6) return m - 1; // F# to F
  if ((pc === 11 || pc === 1) && !overA(step)) return m - 1; // B to Bb, C# to C
  return m;
}

function inMinor(part: Track['part']): Part {
  const p = typeof part === 'string' ? melody(part) : part;
  return { ...p, notes: p.notes.map((n) => ({ ...n, pitches: n.pitches.map((m) => lower(m, n.time)) })) };
}

export default defineSong({
  ...canon,
  title: 'Canon in D Minor',
  description: 'Pachelbel’s Canon moved into D minor: the same notes, lowered where the minor key needs them, over Dm A Bb F Gm Dm Gm A.',
  tracks: canon.tracks.map((track) => ({ ...track, part: inMinor(track.part) })),
});
