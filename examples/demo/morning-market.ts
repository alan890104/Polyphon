// Morning Market: a bright C major tune for a busy town square. Marimba melody, pizzicato bass, light percussion, a soft string bed.

import { arpeggio, bassline, chords, defineSong, melody, pad, rhythm, scaleVelocity } from 'polyphon';

const verse = chords('C | Am | F | G | C | Am | Dm7 G | C');

const tune = melody(`
  E5:2 G5:2 C6:4 B5:2 G5:2 E5:4 | A5:4 G5:2 E5:2 C5:8 | F5:2 A5:2 C6:4 A5:2 F5:2 D5:4 | G5:6 F5:2 E5:4 D5:4 |
  E5:2 G5:2 C6:4 D6:2 C6:2 B5:4 | A5:4 C6:4 E6:8      | D6:4 C6:2 A5:2 B5:4 G5:4       | C6:12 r:4 |
`);

export default defineSong({
  title: 'Morning Market',
  description: 'C major, 112 BPM. Marimba melody over pizzicato bass, shaker and a soft string bed.',
  bpm: 112,
  swing16: 0.08,
  reverb: { size: 1.4, damp: 0.4 },
  delay: { steps: 3, feedback: 0.25, mix: 0.5 },
  intro: [{ name: 'Marimba', instrument: 'marimba', part: arpeggio(chords('C | G'), '0 1 2 1', { center: 'C5' }), gain: 0.8, delay: 0.2 }],
  tracks: [
    { name: 'Marimba', instrument: 'marimba', part: tune, pan: 0.1, delay: 0.2 },
    { name: 'Strings', instrument: 'strPad', part: scaleVelocity(pad(verse, { center: 'C4' }), 0.5), gain: 0.55, reverb: 0.45 },
    { name: 'Bass', instrument: 'pizzBass', part: bassline(verse, 'x...x.x.x...x.x.', '1 5 8 5', { register: 'C2' }), gain: 0.9 },
    { name: 'Kick', instrument: 'kick', part: rhythm('X.......x.......'), gain: 0.7 },
    { name: 'Shaker', instrument: 'shaker', part: rhythm('o.x.o.x.o.x.o.xo'), pan: -0.3 },
  ],
});
