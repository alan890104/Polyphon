// "Journey Across the Continent", the world map: plays while choosing a region, and needs a feeling of anticipation, of "about to set out".
// F major, 4/4, 112 BPM. Here the leitmotif is given in full to the horn for the first time: the major sixth C4 -> A4 followed by G F G (the main theme moved to F major),
// and underneath, spiccato strings lay a forward-driving "da, da-da" figure (an eighth plus two sixteenths), like horse hooves; the snare only lightly taps the marching rhythm.
// Sections: fanfare, 2 bars (trumpets and horns in unison on the call of the F major triad) -> A horn theme, 8 bars (the trumpet answers at the phrase ends, in the second half the flute counterpoints high)
// -> B a new adventure melody given to the strings, turning to D minor (bass D C Bb A descending to A7) and coming back through Gm7, F/C, C7, with the horn switching to long-note counterpoint
// -> C a quiet 4 bars: over a C pedal, the flute doubles the length of the motif's notes, the harp arpeggiates the chords, and a timpani roll leads in
// -> A'' full orchestra: trumpets and horns in unison on the theme, flute counterpoint high; at bar 6 the melody's highest point goes to the flute and horn, and the trumpets pad below on F, A.
// The phrase ends are rounded off with fast rising harp glissandi, and A'' ends on F, which leads naturally back to the opening fanfare.

import { arpeggio, bassline, chords, melody, pad, rest, rhythm, roots, scaleVelocity, sequence, type Song } from 'polyphon';

// ── Harmony
const cFan = 'F | C';
const cA = 'F | Dm | Bb | C | F | Dm | Gm7 C7 | F';
const cB = 'Dm | Dm/C | Bb | A7 | Dm | Gm7 | F/C | C7';
const cC = 'F/C | Bb/C | Gm7/C | C7';
const cA2 = 'F | Dm | Bb | C | F | Dm7 | Gm7 C7 | F';
const pFan = chords(cFan);
const pA = chords(cA);
const pB = chords(cB);
const pC = chords(cC);
const pA2 = chords(cA2);

// ── Fanfare (2 bars)
const FAN_TPT = 'C5:2 C5:1 C5:1 F5:4 A5:6 G5:2 | G5:12 r:4';
const FAN_HRN = 'A4:2 A4:1 A4:1 C5:4 F5:6 E5:2 | E5:12 r:4';

// ── A: the horn theme (the full leitmotif, in F major)
const A_HORN = `C4:4 A4:6 G4:2 F4:2 G4:2 | A4:3 A4:1 D4:4 F4:6 E4:2 | D4:3 D4:1 Bb4:6 A4:2 G4:2 F4:2 | G4:8 r:8 |
  C4:3 C4:1 A4:6 G4:2 F4:2 G4:2 | A4:3 A4:1 C5:4 D5:6 C5:2 | Bb4:4 A4:2 G4:2 G4:4 F4:2 G4:2 | F4:8 r:8`;
/** The trumpet's answer at the horn's phrase ends */
const A_TPT = 'R | R | R | r:8 C5:3 E5:1 G5:4 | R | R | R | r:8 C5:3 F5:1 A5:4';
/** The flute's high counterpoint in the second half of the phrase */
const A_FLUTE = 'R | R | R | R | C6:12 A5:4 | D6:8 F6:8 | D6:8 E6:8 | F6:12 r:4';

// ── B: the strings' adventure melody (D minor, with the dotted-sixteenth "da, da" rhythm as its core)
const B_STR = `D5:3 E5:1 F5:4 A5:6 G5:2 | F5:3 E5:1 D5:4 A4:8 | Bb4:3 C5:1 D5:4 F5:6 E5:2 | E5:4 C#5:4 E5:4 G5:4 |
  A5:3 G5:1 F5:4 D6:6 C6:2 | Bb5:3 A5:1 G5:4 D5:8 | F5:3 G5:1 A5:4 Bb5:6 A5:2 | G5:8 E5:4 C5:4`;
/** The horn switches to long-note counterpoint */
const B_HORN = 'A4:16 | A4:8 F4:8 | D4:16 | C#4:8 E4:8 | D4:8 F4:8 | G4:8 Bb4:8 | A4:8 G4:8 | Bb4:16';

// ── C: a quiet transition, the flute doubles the length of the motif's notes
const C_FLUTE = 'C5:4 A5:12 | G5:4 F5:4 G5:8 | D5:4 Bb5:12 | A5:4 G5:4 F5:4 E5:4';

// ── A'': full orchestra
const A2_HORNS = `C4:3 C4:1 A4:6 G4:2 F4:2 G4:2 | A4:3 A4:1 D4:4 F4:6 E4:2 | D4:3 D4:1 Bb4:6 A4:2 G4:2 F4:2 | G4:8 r:8 |
  C4:3 C4:1 A4:6 G4:2 F4:2 G4:2 | A4:4 C5:4 D5:6 C5:2 | Bb4:4 A4:2 G4:2 G4:4 F4:2 G4:2 | F4:12 r:4`;
const A2_TPTS = `C5:3 C5:1 A5:6 G5:2 F5:2 G5:2 | A5:3 A5:1 D5:4 F5:6 E5:2 | D5:3 D5:1 Bb5:6 A5:2 G5:2 F5:2 | G5:8 r:8 |
  C5:3 C5:1 A5:6 G5:2 F5:2 G5:2 | F5:4 A5:4 A5:8 | Bb5:4 A5:2 G5:2 G5:4 F5:2 G5:2 | F5:12 r:4`;
/** Flute: high long-note counterpoint; bar 6 takes over the melody's highest point (A5 C6 D6 C6), with the trumpets padding below */
const A2_FLUTE = 'F6:16 | D6:16 | D6:8 F6:8 | E6:8 C6:8 | F6:16 | A5:4 C6:4 D6:6 C6:2 | D6:8 E6:8 | F6:12 r:4';

// ── Harp: the fast rising glissando at the phrase ends (thirty-second notes)
const GL_C = 'r:8 C4:1/2 E4 G4 C5 E5 G5 C6 E6 G6:4';
const GL_F = 'r:8 F4:1/2 A4 C5 F5 A5 C6 F6 A6 C7:4';
const GL_C7 = 'r:8 C4:1/2 E4 G4 Bb4 C5 E5 G5 Bb5 C6:4';
const HARP = sequence(
  'R | ' + GL_C,
  `R | R | R | ${GL_C} | R | R | R | ${GL_F}`,
  `R | R | R | ${GL_C7.replace('C4:1/2 E4 G4 Bb4 C5 E5 G5 Bb5 C6:4', 'A3:1/2 C#4 E4 G4 A4 C#5 E5 G5 A5:4')} | R | R | R | ${GL_C7}`,
  arpeggio(pC, '0 1 2 3 4 3 2 1', { step: 2, center: 62, velocity: 0.6 }),
  `R | R | R | ${GL_C} | R | R | R | ${GL_F}`,
);

// ── Spiccato strings: a forward-driving ostinato
const SPICC = sequence(
  arpeggio(pFan, '0-001-112-221-11', { step: 1, center: 53, velocity: 0.75, accent: 4 }),
  arpeggio(pA, '0-001-112-221-11', { step: 1, center: 55, velocity: 0.62, accent: 4 }),
  arpeggio(pB, '0-002-221-112-22', { step: 1, center: 55, velocity: 0.7, accent: 4 }),
  rest(4),
  arpeggio(pA2, '0-001-112-221-11', { step: 1, center: 55, velocity: 0.9, accent: 4 }),
);

// ── Bass (bowed)
const BASS = sequence(
  bassline(pFan, 'x-------x-------', '1', { register: 36 }),
  bassline(pA, 'x-------x-------', '1 5', { register: 36 }),
  bassline(pB, 'x-------x-------', '1 5', { register: 36 }),
  scaleVelocity(melody('C2:64'), 0.6),
  bassline(pA2, 'x-------x---x---', '1 5 8', { register: 36 }),
);
/** Cello section: long open fifths following the bass; the C section is a C pedal */
const CELLI = sequence(
  roots(pFan, { register: 45, fifth: true, velocity: 0.6 }),
  roots(pA, { register: 45, fifth: true, velocity: 0.55 }),
  roots(pB, { register: 45, fifth: true, velocity: 0.65 }),
  scaleVelocity(melody('C3+G3:64'), 0.5),
  roots(pA2, { register: 45, fifth: true, velocity: 0.8 }),
);

// ── Timpani
const TIMP = sequence(
  '!F2:4 r:8 C3:2 C3:2 | !C3:4 r:12',
  'F2:4 r:12 | R | R | C3:4 r:12 | F2:4 r:12 | R | R | r:12 C3:2 C3:2',
  'D3:4 r:12 | R | Bb2:4 r:12 | A2:4 r:12 | D3:4 r:12 | R | R | C3:4 r:12',
  sequence('R | R | R', scaleVelocity(melody('(C3:1)*8'), 0.45), scaleVelocity(melody('(C3:1)*4'), 0.7), melody('(C3:1)*4')),
  '!F2:4 r:4 C3:4 r:4 | D3:4 r:12 | Bb2:4 r:12 | C3:4 r:4 C3:2 C3:2 C3:4 | F2:4 r:12 | Bb2:4 r:12 | G2:4 r:4 C3:4 r:4 | !F2:4 r:12',
);

// ── Marching snare (light)
const SNARE = sequence(
  rhythm('X..xX..xX.x.X...' + 'x.x.x.x.x.xxX...'),
  rhythm('x...o.o.x...o.oo'.repeat(7) + 'x...o.o.x.o.oooo'),
  rhythm('x.oox.oox.oox.oo'.repeat(7) + 'x.oox.oox...o...'),
  rhythm('................'.repeat(3) + 'o...o...o.o.oooo'),
  rhythm('X..ox.oxX..ox.ox'.repeat(7) + 'X.x.x.x.XxxxX...'),
);
const CRASH = sequence(rhythm('x...............'), rest(1 + 8 + 8 + 4), rhythm('X...............'), rest(7));

const song: Song = {
  title: '大陸行路',
  description: '世界地圖。F 大調的行進曲：斷弓弦樂像馬蹄一樣往前推，法國號完整唱出主導動機，小號回應，最後全樂團齊奏。',
  bpm: 112,
  gain: 1.15,
  reverb: { size: 2.2, damp: 0.42, preDelay: 0.02, early: 0.35, mix: 0.9 },
  tracks: [
    { name: '法國號', instrument: 'horn', part: sequence(rest(2), A_HORN, scaleVelocity(melody(B_HORN), 0.75), rest(12)), gain: 1.1, pan: -0.2, reverb: 0.4, params: { release: 0.14 } },
    { name: '法國號齊奏', instrument: 'horns', part: sequence(FAN_HRN, rest(28 - 8), A2_HORNS), gain: 0.7, pan: -0.3, reverb: 0.4, params: { release: 0.14 } },
    { name: '小號', instrument: 'trumpet', part: sequence(rest(2), A_TPT, rest(20)), gain: 0.75, pan: 0.3, reverb: 0.4, params: { release: 0.14 } },
    { name: '小號齊奏', instrument: 'trumpets', part: sequence(FAN_TPT, rest(20), A2_TPTS), gain: 0.7, pan: 0.2, reverb: 0.4, params: { release: 0.14 } },
    { name: '弦樂旋律', instrument: 'strings', part: sequence(rest(10), B_STR, rest(12)), gain: 0.65, pan: 0.15, reverb: 0.42, params: { attack: 0.05 } },
    { name: '長笛', instrument: 'flute', part: sequence(rest(2), A_FLUTE, rest(8), C_FLUTE, A2_FLUTE), gain: 0.75, pan: 0.35, reverb: 0.45 },
    {
      name: '弦樂墊',
      instrument: 'strPad',
      part: sequence(rest(2), scaleVelocity(pad(pA, { center: 60 }), 0.35), scaleVelocity(pad(pB, { center: 58 }), 0.5), rest(4), scaleVelocity(pad(pA2, { center: 62, size: 4 }), 0.55)),
      gain: 0.6,
      pan: 0,
      reverb: 0.5,
    },
    { name: '斷弓弦樂', instrument: 'spicc', part: SPICC, gain: 0.75, pan: -0.15, reverb: 0.3 },
    { name: '豎琴', instrument: 'harp', part: HARP, gain: 0.6, pan: 0.4, reverb: 0.45 },
    { name: '低音', instrument: 'contrabass', part: BASS, gain: 0.55, reverb: 0.2 },
    { name: '大提琴聲部', instrument: 'celli', part: CELLI, gain: 0.42, pan: -0.15, reverb: 0.4, params: { attack: 0.1, release: 0.45 } },
    { name: '定音鼓', instrument: 'timpani', part: TIMP, gain: 0.7, reverb: 0.35 },
    { name: '軍鼓', instrument: 'field', part: scaleVelocity(SNARE, 0.8), gain: 0.5, pan: 0.1, reverb: 0.25 },
    { name: '鈸', instrument: 'crash', part: CRASH, gain: 0.5, reverb: 0.4 },
  ],
};

export default song;
