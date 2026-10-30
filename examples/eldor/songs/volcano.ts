// Emberspine (`volcano`): a fire-element wild song. Lava rivers, Red Iron Keep (the homeland of the sword), knights and blacksmiths.
// E Phrygian scale (E F G# A B C D), 4/4, 108 BPM. The semitone between F and E (bII to I) and the augmented second from F to G# are the signature of this piece.
// Groove: low strings in a spiccato eighth-note ostinato, accents grouped 3+3+2 (the 1st, 4th and 7th eighth notes); the taiko at two pitches follows the same accents;
//       the anvil strikes on beats two and four, like the hammering of Red Iron Keep. No drum kit.
// Core motif: E, F, G# rising (an augmented second), a turn around A and then on to B; the knight theme in the B section is the same motif with note values doubled, given to the trombone.
// Sections: intro, taiko call, 2 bars
//      A ostinato + lute melody, phrase ends closed with tremolo (fast repetition of the same note), a darbuka turnaround
//      B knight theme for trombone and tuba, the lute switches to strummed chords, bar 5 borrows an A major triad (C#) as a proud bright color, the anvil gets denser
//      C a breakdown with only taiko, fire and bass; over the last four bars the taiko gets denser all the way, and a darbuka roll leads back
//      A' the lute returns, the dulcimer doubles it an octave higher, the trombone sings long notes below, and the darbuka plays a maqsum rhythm.

import { bassline, chords, melody, rest, rhythm, scaleVelocity, sequence, stack, strum, transpose, type Song } from 'polyphon';

// ── Harmony (8 bars per section)
const cA = 'E | E | F | E | Am | F | Dm E | E';
const cB = 'E | F E | E | Dm E | A | E | F | E';
const cC = 'E | E | E | F E | E | E | Dm | E';
const pA = chords(cA);
const pB = chords(cB);
const pC = chords(cC);

// ── The low strings' ostinato (3+3+2 accents)
const RE = '!E2:2 E2:2 B2:2 !E2:2 E2:2 C3:2 !E2:2 B2:2';
const RF = '!F2:2 F2:2 C3:2 !F2:2 F2:2 D3:2 !F2:2 C3:2';
const RAm = '!A2:2 A2:2 E3:2 !A2:2 A2:2 F3:2 !A2:2 E3:2';
const RA = '!A2:2 A2:2 E3:2 !A2:2 A2:2 C#3:2 !A2:2 E3:2';
const RDmE = '!D2:2 D2:2 A2:2 !D2:2 E2:2 B2:2 !E2:2 F2:2';
const RFE = '!F2:2 F2:2 C3:2 !F2:2 E2:2 B2:2 !E2:2 B2:2';
const bars = (...b: string[]) => b.join(' | ');
const OST_A = bars(RE, RE, RF, RE, RAm, RF, RDmE, RE);
const OST_B = bars(RE, RFE, RE, RDmE, RA, RE, RF, RE);

// ── Lute melody
const LUTE = bars(
  '!E4:3 F4:1 G#4:4 A4:2 G#4:1 A4:1 B4:4',
  'C5:3 B4:1 A4:2 G#4:2 F4:2 G#4:1 F4:1 E4:4',
  'F4:3 G#4:1 A4:4 C5:2 B4:1 C5:1 D5:4',
  'C5:2 B4:2 A4:1 B4:1 A4:1 G#4:1 F4:2 E4:4 r:2',
  'A4:3 B4:1 C5:4 D5:2 C5:1 D5:1 E5:4',
  'F5:3 E5:1 D5:2 C5:2 B4:2 C5:1 B4:1 A4:4',
  'D5:2 C5:2 B4:2 A4:2 G#4:2 A4:1 G#4:1 F4:4',
  'E4:1 ?E4:1 E4:1 ?E4:1 E4:1 ?E4:1 E4:1 ?E4:1 E4:1 ?E4:1 r:6',
);

// ── Knight theme (trombone), the motif with note values doubled; the C# in bar 5 is an A major triad
const KNIGHT = bars(
  '!E3:4 F3:2 G#3:2 B3:8',
  'A3:4 G#3:2 F3:2 E3:8',
  'E3:4 F3:2 G#3:2 B3:4 E4:4',
  'D4:4 C4:4 B3:8',
  'C#4:6 B3:2 A3:4 C#4:4',
  'B3:4 A3:4 G#3:8',
  'A3:4 C4:4 F4:4 E4:2 D4:2',
  '!E4:12 r:4',
);
const TUBA_B = 'E2:16 | F2:8 E2:8 | E2:16 | D2:8 E2:8 | A1:16 | E2:16 | F2:16 | E2:12 r:4';
/** A': the trombone's long notes under the lute */
const COUNTER = 'B3:16 | C4:8 B3:8 | A3:16 | G#3:16 | C4:16 | A3:16 | F3:8 G#3:8 | E3:12 r:4';
const DEEP_C = 'E2:16 | E2:16 | E2:16 | F2:8 E2:8 | E2:16 | E2:16 | D2:16 | E2:16';

// ── Percussion: taiko (low B1, mid E2, high A2), anvil, darbuka (D3 is doum, D4 is tek)
const TL = 35;
const TM = 40;
const TH = 45;
const eight = (base: string, fill: string) => base.repeat(7) + fill;
const taikoLowA = rhythm(eight('X.....X.....X...', 'X.....X.....X.X.'), { pitch: TL });
const taikoMidA = rhythm(eight('...o......o...o.', '...o......o.x.x.'), { pitch: TM });
const taikoLowB = rhythm(eight('X.....X.....X.x.', 'X.....X.....XXXX'), { pitch: TL });
const taikoMidB = rhythm(eight('...o..x...o...x.', '...o..x...x.x.xx'), { pitch: TM });
/** C: the low taiko holds the 3+3+2, the mid and high taiko trade question and answer, and the last four bars get denser all the way */
const taikoLowC = rhythm(['X.....X.....X...', 'X.....X.....X...', 'X.....X.....X...', 'X.....X.X.X.X...', 'X.....X.....X...', 'X.....X.....X...', 'X.....X.X...X.X.', 'X.X.X.X.X.X.X.X.'].join(''), { pitch: TL });
const taikoMidC = rhythm(['................', '...x.x......x.x.', '................', '...x.x....x.x.x.', '..x.x...x...x.x.', '..x.x...x.x.x.x.', 'x.x.x.x.x.x.x.x.', '................'].join(''), { pitch: TM });
const taikoHiC = rhythm(['................', '................', '...x..x....x....', '........x.x.....', '....x.......x...', 'x...x.......x.xx', '....x...x.x.x.xx', 'x.xxx.xxX.xxXxXx'].join(''), { pitch: TH });
const anvilA = stack(rhythm('....x...........'.repeat(8), { pitch: 88 }), rhythm('............x...'.repeat(8), { pitch: 86 }));
const anvilB = stack(rhythm('....X.......X...'.repeat(8), { pitch: 88 }), rhythm('.......o......xo'.repeat(8), { pitch: 84 }));
const anvilC = sequence(rest(6), stack(rhythm('....x.......x...x...x...x.x.x.xx', { pitch: 88 })));
const DARB_A = 'R | R | R | r:8 D4:1 ?D4:1 D4:1 ?D4:1 D3:2 D4:1 D4:1 | R | R | R | r:10 D4:1 D4:1 D3:1 D4:1 !D4:1 !D4:1';
const DARB_B = 'R | R | R | R | R | R | R | r:8 D4:1 D4:1 D4:1 D4:1 D3:1 D4:1 !D4:2';
const DARB_C = 'R | R | R | R | R | R | r:8 ?D4:1 ?D4:1 D4:1 ?D4:1 D4:1 D4:1 D4:1 D4:1 | (D4:1)*12 !D3:2 !D4:2';
const MAQSUM = 'D3:2 D4:2 r:2 D4:2 D3:2 r:2 D4:2 ?D4:1 ?D4:1';
const DARB_A2 = `${Array(7).fill(MAQSUM).join(' | ')} | D3:2 D4:1 D4:1 D4:1 D4:1 D3:2 D4:1 D4:1 D4:1 D4:1 !D3:2 !D4:2`;

const song: Song = {
  title: '焰脊火山帶',
  description: 'E 弗里吉亞屬音階的行進曲：太鼓、鐵砧、低音弦樂頑固音型、魯特琴旋律，長號與低音號吹騎士主題，底下一直有火聲。',
  bpm: 108,
  reverb: { size: 1.6, damp: 0.7, preDelay: 0.015, early: 0.3, mix: 0.85 },
  intro: [
    { name: '太鼓低', instrument: 'taiko', part: rhythm('X.......X.......X.....X.....X...', { pitch: TL }), gain: 0.3, reverb: 0.2 },
    { name: '太鼓中', instrument: 'taiko', part: rhythm('....x.x.....x.x....x..x...x.xxxx', { pitch: TM }), gain: 0.35, pan: -0.25, reverb: 0.2 },
    { name: '火', instrument: 'fire', part: 'C4:32', gain: 0.7, reverb: 0.15, params: { attack: 2.5, release: 2 } },
    { name: '低音', instrument: 'contrabass', part: 'E2:32', gain: 0.5, reverb: 0.3, params: { attack: 1.5 } },
  ],
  tracks: [
    // Melody
    { name: '魯特琴', instrument: 'lute', part: sequence(LUTE, rest(16), LUTE), gain: 1.6, pan: 0.2, reverb: 0.32 },
    { name: '揚琴', instrument: 'dulcimer', part: sequence(rest(24), scaleVelocity(transpose(melody(LUTE), 12), 0.7)), gain: 0.5, pan: -0.3, reverb: 0.35 },
    { name: '長號', instrument: 'trombone', part: sequence(rest(8), KNIGHT, rest(8), scaleVelocity(melody(COUNTER), 0.6)), gain: 0.85, pan: -0.15, reverb: 0.35 },
    { name: '低音號', instrument: 'tuba', part: sequence(rest(8), TUBA_B, rest(16)), gain: 0.75, reverb: 0.25 },
    { name: '魯特琴刷奏', instrument: 'lute', part: sequence(rest(8), strum(pB, 'X-----x-X---x---', { center: 60, size: 4, spread: 0.02 }), rest(16)), gain: 0.6, pan: 0.3, reverb: 0.3 },
    // Bass
    { name: '頑固音型', instrument: 'spicc', part: sequence(OST_A, OST_B, rest(8), OST_A), gain: 0.85, pan: -0.1, reverb: 0.2 },
    {
      name: '撥奏低音',
      instrument: 'pizzBass',
      part: sequence(bassline(pA, 'x-----x-x---x---', '1', { register: 36 }), rest(8), bassline(pC, 'x-----x-x---x---', '1', { register: 36 }), bassline(pA, 'x-----x-x---x---', '1', { register: 36 })),
      gain: 0.45,
    },
    { name: '弓奏低音', instrument: 'contrabass', part: sequence(rest(16), DEEP_C, rest(8)), gain: 0.6, reverb: 0.3 },
    // Percussion
    { name: '太鼓低', instrument: 'taiko', part: sequence(taikoLowA, taikoLowB, taikoLowC, taikoLowA), gain: 0.25, reverb: 0.2 },
    { name: '太鼓中', instrument: 'taiko', part: sequence(taikoMidA, taikoMidB, taikoMidC, taikoMidA), gain: 0.35, pan: -0.25, reverb: 0.2 },
    { name: '太鼓高', instrument: 'taiko', part: sequence(rest(16), taikoHiC, rest(8)), gain: 0.35, pan: 0.25, reverb: 0.2 },
    { name: '鐵砧', instrument: 'anvil', part: sequence(anvilA, anvilB, anvilC, anvilA), gain: 1.3, pan: 0.35, reverb: 0.22 },
    { name: '手鼓', instrument: 'darbuka', part: sequence(DARB_A, DARB_B, DARB_C, DARB_A2), gain: 0.7, pan: -0.3, reverb: 0.15 },
    // Ambience
    { name: '火', instrument: 'fire', part: 'C4:512', gain: 0.7, reverb: 0.15, params: { attack: 2, release: 2 } },
  ],
};

export default song;
