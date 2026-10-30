// Stormreach (`plains`), "Thunder Chaser": a grassland that stretches beyond sight, with ever-rolling thunderclouds overhead, and nomadic tribes riding horses and following the thunderclouds as they migrate.
// C minor, 4/4, 132 BPM. The very first second is a close lightning strike, and the whole piece has three protagonists:
//   Thunder: a lightning strike (a tearing crack followed by a dull boom and rolling thunder) lands on the first beat of a section, while distant muffled thunder rolls through the quiet sections;
//       timpani rolls push each strike out, and for the flash itself brass stabs and a cymbal crash down together.
//   Horses: a "da, da-da" galloping rhythm (an eighth note followed by two sixteenths), growing from the frame drum's distant hoofbeats into a whole company of cavalry in low strings and toms.
//   People: the morin khuur sings a broad theme, sliding upward at phrase ends; in the storm section strings and trumpets sing a higher second theme, with the choir padding behind.
// The harmony follows the epic i, VI, III, VII (Cm Ab Eb Bb); the storm section ends on a G major triad, returning to C minor for the quiet section.
// Sections (28 bars, about 51 seconds):
//   A   Grassland: wind, distant hoofbeats, solo morin khuur, distant muffled thunder in bar 4
//   A'  Thunderclouds press in: a lightning strike, the strings take up the theme with the horn an octave below, low strings and toms begin to gallop
//   B   Storm: the second theme sung in unison, strings above and trumpets below, choir and taiko come in, lightning strikes with flashes in bars 1 and 5
//   C   Rain: only rain, distant thunder and morin khuur, a timpani roll leads back to A

import { bassline, chords, pad, rest, rhythm, scaleVelocity, sequence, strum, transpose, type Song } from 'polyphon';

// ── Harmony
const A = chords('Cm | Ab | Eb | Bb | Cm | Ab | Ab:8 Bb:8 | Cm');
const B = chords('Ab | Eb | Bb | Cm | Ab | Eb | Bb | Gsus4:8 G:8');
const C = chords('Cm | Ab | Fm | G');

// ── Melody
/** Theme: a leap of a fourth up from C, the highest points on Eb and F, the phrase end sliding back to C */
const MEL_A = 'C5:6 G4:2> C5:4 D5:4 | Eb5:12 D5:2 C5:2 | Bb4:6 G4:2> Bb4:4 C5:4 | D5:16 | Eb5:6 D5:2 C5:4 Eb5:4 | F5:8 Eb5:4 C5:4 | Eb5:4 C5:4 D5:4 F5:4 | C5:12 r:4';
/** The storm's second theme: big leaps of a sixth, each phrase higher than the last, finally stopping on G */
const MEL_B = 'C5:4 Eb5:4 Ab5:8 | G5:6 F5:2 Eb5:8 | F5:4 D5:4 Bb5:8 | G5:12 r:4 | C6:4 Bb5:4 Ab5:8 | G5:4 Bb5:4 Eb6:8 | D6:6 C6:2 Bb5:4 F5:4 | G5:16';
/** The horn's long-note counterpoint in the storm section */
const HORN_B = 'Ab4:16 | G4:16 | F4:16 | Eb4:16 | Ab4:16 | Bb4:16 | F4:16 | C4:8 B3:8';
/** The morin khuur in the rain: the opening of the theme, landing on the leading tone B */
const MEL_C = 'C5:6 G4:2> C5:4 D5:4 | Eb5:12 r:4 | Ab4:6 F4:2> Ab4:4 C5:4 | B4:12 r:4';

// ── Gallop: "da, da-da"
const GALLOP = 'X.xxX.xxX.xxX.xx';
const GALLOP_SOFT = 'x.oox.oox.oox.oo';

const song: Song = {
  title: '追雷者',
  description: 'C 小調的草原暴風。開頭就是一聲落雷，框鼓的馬蹄聲長成整隊騎兵的奔馳；馬頭琴唱寬闊的主題，暴風段弦樂與小號齊唱第二主題，合唱與太鼓壓上來。',
  bpm: 132,
  gain: 0.55,
  reverb: { size: 3.2, damp: 0.5, preDelay: 0.03, early: 0.3, mix: 0.8 },
  intro: [
    { name: '落雷', instrument: 'thunderclap', part: rhythm('X...............|................'), gain: 1.1, reverb: 0.4 },
    { name: '風', instrument: 'wind', part: 'C4:32', gain: 0.7, params: { attack: 0.3, release: 1.5 } },
    { name: '低音大提琴', instrument: 'contrabass', part: 'C2:32', gain: 0.7, params: { attack: 0.8 } },
    { name: '定音鼓', instrument: 'timpani', part: rhythm('................|o.o.o.o.x.x.XXXX', { pitch: 43 }), gain: 0.7, reverb: 0.3 },
    { name: '框鼓', instrument: 'frame', part: rhythm('................|x.oox.oox.oox.oo'), gain: 0.5, pan: 0.2, reverb: 0.3 },
  ],
  tracks: [
    // ── Melody
    { name: '馬頭琴', instrument: 'morin', part: sequence(MEL_A, rest(8), rest(8), MEL_C), gain: 1.5, pan: 0.05, reverb: 0.4 },
    { name: '弦樂', instrument: 'strings', part: sequence(rest(8), MEL_A, MEL_B, rest(4)), gain: 1.6, pan: 0.1, reverb: 0.35, params: { attack: 0.03, release: 0.25, bright: 1.15 } },
    { name: '法國號', instrument: 'horns', part: sequence(rest(8), transpose(sequence(MEL_A), -12), HORN_B, rest(4)), gain: 0.55, pan: -0.3, reverb: 0.45, params: { release: 0.15 } },
    { name: '小號', instrument: 'trumpets', part: sequence(rest(16), transpose(sequence(MEL_B), -12), rest(4)), gain: 0.6, pan: -0.1, reverb: 0.35, params: { release: 0.12 } },
    { name: '合唱', instrument: 'choir', part: sequence(rest(16), scaleVelocity(pad(B, { center: 64, size: 3 }), 0.65), rest(4)), gain: 0.8, pan: 0.15, reverb: 0.5, params: { attack: 0.2 } },
    // ── Harmony and bass
    { name: '弦樂墊', instrument: 'strPad', part: sequence(scaleVelocity(pad(A, { center: 55, size: 3 }), 0.55), scaleVelocity(pad(A, { center: 55, size: 3 }), 0.7), rest(8), scaleVelocity(pad(C, { center: 55, size: 3 }), 0.55)), gain: 0.8, pan: -0.15, reverb: 0.45 },
    { name: '奔馳低音', instrument: 'spicc', part: sequence(rest(8), bassline(A, GALLOP, '1', { register: 48 }), bassline(B, GALLOP, '1', { register: 48 }), rest(4)), gain: 0.7, pan: -0.1, reverb: 0.2 },
    { name: '低音大提琴', instrument: 'contrabass', part: sequence(bassline(A, 'x---------------', '1', { register: 36 }), bassline(A, 'x-------x-------', '1 5', { register: 36 }), bassline(B, 'x-------x-------', '1 5', { register: 36 }), bassline(C, 'x---------------', '1', { register: 36 })), gain: 0.7 },
    // ── Thunder and lightning
    { name: '落雷', instrument: 'thunderclap', part: sequence(rest(8), rhythm('X...............'), rest(7), rhythm('X...............'), rest(3), rhythm('X...............'), rest(7)), gain: 1.0, reverb: 0.4 },
    { name: '遠雷', instrument: 'thunder', part: sequence(rest(3), rhythm('X...............'), rest(21), rhythm('....X...........'), rest(2)), gain: 0.9, pan: -0.3, reverb: 0.5 },
    { name: '閃電', instrument: 'brassStab', part: sequence(rest(8), strum(chords('Cm'), 'X...............', { center: 60, size: 4, spread: 0 }), rest(7), strum(chords('Ab'), 'X...............', { center: 60, size: 4, spread: 0 }), rest(3), strum(chords('Ab'), 'X...............', { center: 60, size: 4, spread: 0 }), rest(7)), gain: 0.7, reverb: 0.4 },
    { name: '鈸', instrument: 'crash', part: sequence(rest(8), rhythm('X...............'), rest(7), rhythm('X...............'), rest(3), rhythm('X...............'), rest(7)), gain: 0.55, reverb: 0.3 },
    { name: '定音鼓', instrument: 'timpani', part: sequence(rest(7), rhythm('o.o.o.o.x.x.xxXX', { pitch: 43 }), rest(7), rhythm('o.o.x.x.x.xxXXXX', { pitch: 43 }), bassline(B, 'X...............', '1', { register: 36 }), rest(3), rhythm('o.o.o.o.x.x.xxXX', { pitch: 43 })), gain: 0.75, reverb: 0.3 },
    // ── Hooves and drums
    { name: '框鼓', instrument: 'frame', part: sequence(rhythm(GALLOP_SOFT.repeat(8)), rhythm(GALLOP.repeat(8)), rhythm(GALLOP.repeat(8)), rhythm('x.......x.......'.repeat(4))), gain: 0.5, pan: 0.2, reverb: 0.3 },
    { name: '中鼓', instrument: 'tom', part: sequence(rest(8), rhythm(('X.......x.......'.repeat(3) + 'X.......x.x.xxxx').repeat(2)), rhythm(('X.......X.......'.repeat(3) + 'X.x.X.x.XxXxXXXX').repeat(2)), rest(4)), gain: 0.55, pan: -0.2, reverb: 0.3 },
    { name: '太鼓', instrument: 'taiko', part: sequence(rest(16), rhythm('X.......X.......'.repeat(7) + 'X...X...X.X.XXXX'), rest(4)), gain: 0.7, reverb: 0.25 },
    { name: '反向鈸', instrument: 'swell', part: sequence(rest(15), rhythm('...X............'), rest(12)), gain: 0.45, reverb: 0.3 },
    // ── Weather
    { name: '風', instrument: 'wind', part: sequence('C4:128', rest(20)), gain: 0.6, params: { attack: 0.5, release: 2 } },
    { name: '雨', instrument: 'rain', part: sequence(rest(16), 'C4:192'), gain: 0.6, params: { attack: 2, release: 1.5 } },
  ],
};

export default song;
