// Night Waltz: a slow A minor waltz in 3/4. Piano melody, harp arpeggios, a string pad and cellos on the roots.

import { arpeggio, chords, defineSong, melody, pad, roots, scaleVelocity } from 'polyphon';

const harmony = chords('Am | F | C | E | Am | Dm | E7 | Am', '3/4');

const theme = melody(
  `E5:8 C5:2 B4:2 | A4:8 C5:4 | G4:4 E5:4 D5:4 | B4:12 |
   E5:8 A5:2 G5:2 | F5:6 E5:2 D5:4 | D5:4 C5:4 B4:4 | A4:12 |`,
  '3/4',
);

export default defineSong({
  title: 'Night Waltz',
  description: 'A minor, 3/4, 84 BPM. Piano over harp arpeggios, a string pad and cellos.',
  bpm: 84,
  meter: '3/4',
  reverb: { size: 2.6, damp: 0.5, preDelay: 0.02 },
  tracks: [
    { name: 'Piano', instrument: 'piano', part: theme, gain: 0.9, pan: 0.1, reverb: 0.35 },
    { name: 'Harp', instrument: 'harp', part: arpeggio(harmony, '0 1 2 1 2 1', { center: 'A3' }), gain: 0.6, pan: -0.25, reverb: 0.4 },
    { name: 'Strings', instrument: 'strPad', part: scaleVelocity(pad(harmony, { center: 'E4' }), 0.45), gain: 0.5, reverb: 0.5 },
    { name: 'Cellos', instrument: 'celli', part: roots(harmony, { register: 'A2' }), gain: 0.55, reverb: 0.4 },
  ],
});
