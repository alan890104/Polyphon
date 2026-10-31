// Pachelbel, Canon in D (Canon per 3 violini e basso), complete.
// A strict canon: three violins play the same line, each entering two bars after the one before, over a two-bar ground bass
// that the cello plays 28 times. At the end each violin breaks off the line and lands on its own note of the final D chord.
// Notes checked against the Mutopia Project edition (public domain music; the edition is CC BY 4.0).

import { defineSong, melody, repeat, rest, scaleVelocity, sequence, slice } from 'polyphon';

/** The ground: eight quarter notes, two bars */
const ground = melody('D3:4 A2 B2 F#2 | G2 D2 G2 A2 |');

/** The violins' line, written one pass of the ground (two bars, 32 steps) per row */
const line = melody(`
  F#5:4 E5 D5 C#5 B4 A4 B4 C#5 |
  D5 C#5 B4 A4 G4 F#4 G4 E4 |
  D4:2 F#4 A4 G4 F#4 D4 F#4 E4 D4 B3 D4 A4 G4 B4 A4 G4 |
  F#4 D4 E4 C#5 D5 F#5 A5 A4 B4 G4 A4 F#4 D4 D5 D5:3 C#5:1 |
  D5 C#5 D5 D4 C#4 A4 E4 F#4 D4 D5 C#5 B4 C#5 F#5 A5 B5 G5 F#5 E5 G5 F#5 E5 D5 C#5 B4 A4 G4 F#4 E4 G4 F#4 E4 |
  D4 E4 F#4 G4 A4 E4 A4 G4 F#4 B4 A4 G4 A4 G4 F#4 E4 D4 B3 B4 C#5 D5 C#5 B4 A4 G4 F#4 E4 B4 A4 B4 A4 G4 |
  F#4:2 F#5 E5:4 r:2 D5 F#5:4 B5 A5 B5 C#6 |
  D6:2 D5 C#5:4 r:2 B4 D5:4 D5:6 D5:2 D5 G5 E5 A5 |
  A5:1 F#5:1/2 G5 A5:1 F#5:1/2 G5 A5 A4 B4 C#5 D5 E5 F#5 G5 F#5:1 D5:1/2 E5 F#5:1 F#4:1/2 G4 A4 B4 A4 G4 A4 F#4 G4 A4 G4:1 B4:1/2 A4 G4:1 F#4:1/2 E4 F#4 E4 D4 E4 F#4 G4 A4 B4 G4:1 B4:1/2 A4 B4:1 C#5:1/2 D5 A4 B4 C#5 D5 E5 F#5 G5 A5 |
  F#5:1 D5:1/2 E5 F#5:1 E5:1/2 D5 E5 C#5 D5 E5 F#5 E5 D5 C#5 D5:1 B4:1/2 C#5 D5:1 D4:1/2 E4 F#4 G4 F#4 E4 F#4 D5 C#5 D5 B4:1 D5:1/2 C#5 B4:1 A4:1/2 G4 A4 G4 F#4 G4 A4 B4 C#5 D5 B4:1 D5:1/2 C#5 D5:1 C#5:1/2 B4 C#5 D5 E5 D5 C#5 D5 B4 C#5 |
  D5:2 r:2 C#5 r:2 B4 r:2 D5 r:2 D4 r:2 D4 r:2 D4 r:2 E4 r:2 |
  r:2 A4 r:2 A4 r:2 F#4 r:2 A4 r:2 G4 r:2 F#4 r:2 G4 r:2 E5 |
  F#5:1 F#4 G4 F#4 E4 E5 F#5 E5 D5 F#4 D4 B4 A4 A3 G3 A3 B3 B4 C#5 B4 A4 A3 G3 A3 B3 B4 A4 B4 C#5 C#4 B3 C#4 |
  D4 D5 E5 D5 C#5 C#4 D4 C#4 B3 B4 A4 B4 C#5 C#4 F#4 E4 D4 D5 E5 G5 F#5 F#4 A4 F#5 D5 G5 F#5 G5 E5 A4 G4 A4 |
  F#4 A4 A4 A4 A4 A4 A4 A4 F#4 F#4 F#4 F#4 F#4 F#4 A4 A4 G4 G4 G4 D5 D5 D5 D5 D5 D5 D5 B4 B4 A4 A4 E5 C#5 |
  A4 F#5 F#5 F#5 E5 E5 E5 E5 D5 D5 D5 D5 A5 A5 A5 A5 B5 B5 B5 B5 A5 A5 A5 A5 B5 B5 B5 B5 C#6 C#5 C#5 C#5 |
  D5 D4:1/2 E4 F#4:1 D4 C#4 C#5:1/2 D5 E5:1 C#5 B4 B3:1/2 C#4 D4:1 B3 C#4 A4:1/2 G4 F#4:1 E4 D4 G4:1/2 F#4 E4:1 G4 F#4 D4:1/2 E4 F#4:1 A4 G4 B4:1/2 A4 G4:1 F#4 E4 A4:1/2 G4 F#4:1 E4 |
  F#4 D5:1/2 C#5 D5:1 F#4 A4 A4:1/2 B4 C#5:1 A4 F#4 D5:1/2 E5 F#5:1 D5 F#5 F#5:1/2 E5 D5:1 C#5 B4 B4:1/2 A4 B4:1 C#5 D5 F#5:1/2 E5 D5:1 F#5 G5 D5:1/2 C#5 B4:1 B4 A4 E4 A4 A4 |
  A4:6 A4:2 D4:6 A4:2 G4:4 A4 G4:2 D4 D4:3 C#4:1 |
  D4:2 D5 C#5:4 B4 A4 D4:3 E4:1 F#4:4 B4 E4:3 E4:1 |
  F#4:3 F#5:1 F#5 G5 F#5 E5 D5:3 D5:1 D5 E5 D5 C#5 B4:4 D5 D5:1 C5 B4 C5 A4:3 A4:1 |
  A4:3 A5:1 A5 B5 A5 G5 F#5:3 F#5:1 F#5 G5 F#5 E5 D5 C5 B4 C5 A4:3 A4:1 G4:2 D5 C#5:3 C#5:1 |
  D5:2 D5:4 C#5 B4 A4 G4 F#4:5 E4:1 E4:4 |
  F#4:2 F#5:4 E5:2 D5 D6:4 C6:2 B5:4 D6:2 A5 B5:4 A5 |
  A5 A4:3 G4:1 F#4:4 F#5:3 E5:1 D5:6 D5:2 D5:4 C#5 |
  D5:2 D4 C#4 C#5 B4 B3 A3 A4 G4 G5 F#5 F#4 E4 B4 E4 E5 |
  F#5 F#4 E4 E5 D5 D4 C#4 C#5 B4 B5 A5 A4 G4:3 E5:1 A4:2 A4 |
`, 32);

/** A violin enters after some bars of rest, plays the line until bar 56, then holds its note of the final chord */
const violin = (entry: number, last: string) => sequence(rest(entry), slice(line, 0, (56 - entry) * 16), last);

export default defineSong({
  title: 'Canon in D',
  description: 'Pachelbel, complete, in its original scoring: three violins in canon over a cello repeating a two-bar ground.',
  bpm: 55,
  loop: false,
  reverb: { size: 2.6, damp: 0.45, preDelay: 0.022, mix: 0.9 },
  tracks: [
    { name: 'Violin I', instrument: 'violin', part: violin(2, 'A4:4'), gain: 0.8, pan: -0.45, reverb: 0.35 },
    { name: 'Violin II', instrument: 'violin', part: violin(4, 'F#5:4'), gain: 0.8, pan: 0.45, reverb: 0.35 },
    { name: 'Violin III', instrument: 'violin', part: violin(6, 'D5:4'), gain: 0.8, pan: -0.1, reverb: 0.35 },
    { name: 'Cello', instrument: 'cello', part: scaleVelocity(sequence(repeat(ground, 28), 'D3:4'), 0.8), gain: 1.1, pan: 0.15, reverb: 0.35 },
  ],
});
