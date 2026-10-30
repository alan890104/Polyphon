// Beethoven, Piano Sonata No. 14 in C-sharp minor, Op. 27 No. 2 ("Moonlight"), first movement, bars 1-9.
// Adagio sostenuto, alla breve: triplet arpeggios in the middle, octaves in the bass, and from bar 5 the melody with its dotted G#.
// Notes checked against the Mutopia Project edition (public domain music; the edition is CC BY-SA 2.5).
// "Senza sordino": the sustain pedal is held throughout, changed with each harmony.

import { chords, defineSong, melody, pedal, scaleVelocity } from 'polyphon';

/** The harmony, bar by bar: the pedal changes with each chord */
const harmony = chords('C#m | C#m/B | A D/F# | G#7 C#m/G# G#sus4 G#7 | C#m | G#7/B# | C#m F#m/C# | B7 B7 | E');

/** Triplet eighths: three to a beat, 4/3 of a step each */
const triplets = melody(`
  (G#3:4/3 C#4 E4)*4 |
  (G#3 C#4 E4)*4 |
  (A3 C#4 E4)*2 (A3 D4 F#4)*2 |
  G#3 B#3 F#4 G#3 C#4 E4 G#3 C#4 D#4 F#3 B#3 D#4 |
  E3 G#3 C#4 (G#3 C#4 E4)*3 |
  (G#3 D#4 F#4)*4 |
  (G#3 C#4 E4)*2 (A3 C#4 F#4)*2 |
  (G#3 B3 E4)*2 (A3 B3 D#4)*2 |
  G#3 B3 r (G#3 B3 E4)*3 |
`);

const theme = melody(`
  R | R | R | R |
  r:12 G#4:3 G#4:1 |
  G#4:12 G#4:3 G#4:1 |
  G#4:8 A4 |
  G#4:8 F#4:4 B4 |
  E4:4 r:12 |
`);

const bass = melody(`
  C#2+C#3:16 |
  B1+B2:16 |
  A1+A2:8 F#1+F#2 |
  G#1+G#2:8 G#1+G#2 |
  C#2+G#2+C#3:16 |
  B#1+G#2+B#2:16 |
  C#2+C#3:8 F#1+F#2 |
  B1+B2:8 B1+B2 |
  E2+E3:16 |
`);

export default defineSong({
  title: 'Moonlight Sonata (I. Adagio sostenuto)',
  description: 'Beethoven, Op. 27 No. 2, bars 1-9: triplet arpeggios, bass octaves and the dotted melody, pianissimo, pedalled with the harmony.',
  bpm: 54,
  loop: false,
  reverb: { size: 2.8, damp: 0.55, preDelay: 0.02, mix: 0.9 },
  tracks: [
    { name: 'Triplets', instrument: 'piano', part: pedal(scaleVelocity(triplets, 0.55), harmony), gain: 0.8, reverb: 0.35, humanize: 0.006 },
    { name: 'Melody', instrument: 'piano', part: pedal(scaleVelocity(theme, 1.1), harmony), reverb: 0.35 },
    { name: 'Bass', instrument: 'piano', part: pedal(scaleVelocity(bass, 0.75), harmony), gain: 0.9, reverb: 0.35 },
  ],
});
