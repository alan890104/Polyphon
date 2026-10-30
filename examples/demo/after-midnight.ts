// After Midnight: an original piano ballad in B minor, in the spirit of a Mandopop nocturne.
// Piano arpeggios and melody over a slow R&B groove; strings come in for the chorus, and a violin sings the second chorus.

import { arpeggio, bassline, chords, defineSong, melody, pad, rest, rhythm, roots, scaleVelocity, sequence, transpose } from 'polyphon';

const INTRO = 'Bm | Gmaj7 | Em7 | F#7sus4 F#7';
const VERSE = 'Bm | Gmaj7 | Em7 | F#7sus4 F#7 | Bm | Dmaj7/A | Gmaj7 | Em7 F#7';
const CHORUS = 'Gmaj7 | A | F#m7 | Bm | Em7 | A | Dmaj7 | F#7sus4 F#7';

const intro = chords(INTRO);
const verse = chords(VERSE);
const chorus = chords(CHORUS);
const song = chords(`${VERSE} | ${CHORUS} | ${CHORUS}`);

const introTune = melody('r:8 F#5:2 E5:2 D5:2 B4:2 | D5:16 | r:8 E5:2 D5:2 B4:2 G4:2 | C#5:8 A#4:4 r:4 |');

const verseTune = melody(`
  r:4 F#4:2 B4:2 C#5:2 D5:4 C#5:2 | B4:6 A4:2 B4:4 F#4:4 | r:2 G4:2 A4:2 B4:2 D5:4 E5:2 D5:2 | C#5:8 A#4:4 r:4 |
  r:4 F#4:2 B4:2 C#5:2 D5:4 F#5:2 | E5:6 D5:2 C#5:4 A4:4 | B4:2 C#5:2 D5:4 C#5:2 B4:2 A4:2 G4:2 | G4:4 F#4:4 E4:2 F#4:6 |
`);

const chorusTune = melody(`
  D5:2 E5:2 F#5:6 E5:2 D5:2 B4:2 | C#5:6 E5:2 C#5:4 A4:4 | A4:2 B4:2 C#5:6 B4:2 A4:2 F#4:2 | B4:12 r:4 |
  G5:2 F#5:2 E5:6 D5:2 E5:2 F#5:2 | E5:6 C#5:2 A4:4 C#5:4 | D5:4 C#5:2 D5:2 F#5:4 A5:4 | B4:2 C#5:2 E5:4 C#5:4 A#4:4 |
`);

/** Eight bars of a drum pattern, one bar repeated */
const bars8 = (bar: string) => rhythm(bar.repeat(8));

export default defineSong({
  title: 'After Midnight',
  description: 'An original piano ballad in B minor: piano arpeggios over a slow R&B groove, strings in the chorus, a violin on the second chorus.',
  bpm: 68,
  swing16: 0.06,
  reverb: { size: 2.2, damp: 0.5, preDelay: 0.02 },
  delay: { steps: 3, feedback: 0.28, tone: 2400, mix: 0.6 },
  intro: [
    { name: 'Piano', instrument: 'piano', part: introTune, pan: 0.1, reverb: 0.4, delay: 0.15, params: { release: 0.8 } },
    { name: 'Piano arpeggio', instrument: 'piano', part: arpeggio(intro, '0 2 3 2 1 2 3 2', { center: 'B3', size: 4, velocity: 0.45 }), pan: -0.1, reverb: 0.35, params: { release: 1 } },
    { name: 'Strings', instrument: 'strPad', part: scaleVelocity(pad(intro, { center: 'D4' }), 0.35), gain: 0.5, reverb: 0.5 },
  ],
  tracks: [
    // Melody: piano for the verse and first chorus, the violin takes the second chorus with a high piano echo
    { name: 'Piano', instrument: 'piano', part: sequence(verseTune, chorusTune, scaleVelocity(transpose(chorusTune, 12), 0.45)), pan: 0.1, reverb: 0.35, delay: 0.12, params: { release: 0.8 } },
    { name: 'Violin', instrument: 'violin', part: sequence(rest(16), chorusTune), gain: 0.9, pan: 0.2, reverb: 0.45, delay: 0.1 },
    // Harmony
    { name: 'Piano arpeggio', instrument: 'piano', part: arpeggio(song, '0 2 3 2 1 2 3 2', { center: 'B3', size: 4, velocity: 0.5 }), pan: -0.1, reverb: 0.3, params: { release: 1 } },
    { name: 'Strings', instrument: 'strPad', part: sequence(rest(8), scaleVelocity(pad(chorus, { center: 'D4' }), 0.5), scaleVelocity(pad(chorus, { center: 'E4' }), 0.65)), gain: 0.6, reverb: 0.5 },
    { name: 'Cellos', instrument: 'celli', part: sequence(rest(16), roots(chorus, { register: 'B2', velocity: 0.6 })), gain: 0.5, reverb: 0.4 },
    { name: 'Bass', instrument: 'bass', part: bassline(song, 'x.....x.x.......', '1 1 5', { register: 'C2' }), gain: 0.9 },
    // Groove: brushed in the verse, a full backbeat in the choruses
    { name: 'Kick', instrument: 'kick', part: sequence(bars8('X.........x.....'), bars8('X.....x...X..x..'), bars8('X.....x...X..x..')), gain: 0.6 },
    { name: 'Snare', instrument: 'snare', part: sequence(rest(8), bars8('....X.......X...'), bars8('....X.......X..o')), gain: 0.5, reverb: 0.35 },
    { name: 'Rim', instrument: 'rim', part: sequence(bars8('....x.......x...'), rest(16)), gain: 0.6, reverb: 0.3 },
    { name: 'Hi-hat', instrument: 'hat', part: sequence(bars8('x.o.x.o.x.o.x.o.'), bars8('x.o.x.o.x.o.x.ox'), bars8('x.o.x.o.x.o.x.ox')), gain: 0.35, pan: 0.25 },
    { name: 'Cymbal', instrument: 'crash', part: sequence(rest(8), rhythm('X'.padEnd(128, '.')), rhythm('X'.padEnd(128, '.'))), gain: 0.4, reverb: 0.4 },
  ],
});
