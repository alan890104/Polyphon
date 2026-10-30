// "Rival Kael": the duel with his rival Kael, a hot-blooded knight apprentice who later becomes a partner fighting at your side.
// Idea: shonen-manga style fired-up rock. E minor, 176 BPM, the chorus turns to the relative major G.
// Rival motif: E4 -> B4 -> E5 -> D5 (a leap of a fifth, then a fourth up to the octave, then a step back); the whole piece grows from it:
// the distorted guitar plays it as the intro riff in power chords, the trumpet sings it in the verse, the chorus moves it to G (G -> D -> G -> F#) and then back to E,
// the bridge switches to the leitmotif in G major (the A4 -> F#5 major-sixth leap, here moved to G: D5 -> B5): the strings sing the melody, with the trumpet following a third and a sixth below,
// the two voices walking together like two people shoulder to shoulder; in the last four bars the double kick returns, the guitar flings out the rival motif again, and rushes into the final chorus.
// Sections: intro 4 bars -> A verse (palm-muted chug, trumpet) -> A' (guitar switches to open power chords, double-kick sixteenth notes, spiccato ostinato, string bass counterpoint)
// -> pre-chorus 4 bars (strings rise in octaves, snare gets denser) -> B chorus in G major -> C bridge -> B' chorus (strings an octave higher, layered on the trumpet) -> C D Em leading back to the verse.

import { bassline, chords, melody, pad, rest, rhythm, scaleVelocity, sequence, transpose, type Chord, type Song } from 'polyphon';

// ── Harmony (A, A', pre-chorus, B, C, B'; 44 bars in total)
const cA = 'Em | Em | C | D | Em | Em | C | B';
const cPre = 'C | D | Em | D/F#';
const cB = 'G | D | Em | C | G | D | C | D';
const cC1 = 'G | Em | C | D';
const cC2 = 'Em | C | Am | D';
const pA = chords(cA);
const pPre = chords(cPre);
const pB = chords(cB);
/** For the string long notes: the last bar follows the trumpet's 4 -> 3 suspension (G -> F#) */
const pBpad = chords('G | D | Em | C | G | D | C | D:8 Dsus4:4 D:4');
const pC1 = chords(cC1);
const pC2 = chords(cC2);

// ── Trumpet: verse
const TA =
  'E4:2 B4:2 !E5:6 D5:4 r:2 | B4:6 A4:2 G4:2 A4:2 B4:4 | E4:2 B4:2 !E5:6 G5:4 r:2 | F#5:6 E5:2 D5:2 E5:2 r:4 | ' +
  'E4:2 B4:2 !E5:6 D5:4 r:2 | B4:6 A4:2 G4:2 A4:2 B4:4 | C5:2 G5:2 !C6:6 B5:4 r:2 | A5:4 F#5:4 D#5:4 B4:4';
/** A': the last four bars rush upward */
const TA2 =
  'E4:2 B4:2 !E5:6 D5:4 r:2 | B4:6 A4:2 G4:2 A4:2 B4:4 | E4:2 B4:2 !E5:6 G5:4 r:2 | F#5:6 E5:2 D5:2 E5:2 r:4 | ' +
  'E4:2 B4:2 !E5:6 F#5:2 G5:2 A5:2 | B5:8 A5:4 G5:4 | C5:2 G5:2 !C6:8 B5:4 | B5:6 A5:2 F#5:4 D#5:4';
// ── Chorus (G major): the motif appears in turn on G, E and C
const CH_HEAD =
  'G4:2 D5:2 !G5:8 F#5:2 E5:2 | F#5:6 D5:2 A4:4 D5:4 | E4:2 B4:2 !E5:8 D5:2 E5:2 | G5:6 F#5:2 E5:4 D5:4 | ' +
  'G4:2 D5:2 !G5:8 A5:2 B5:2 | A5:6 F#5:2 D5:4 A5:4 | ';
const CH = CH_HEAD + 'C5:2 G5:2 !C6:8 B5:2 A5:2 | B5:6 A5:2 G5:4 F#5:4';
const CH2 = CH_HEAD + 'C5:2 G5:2 !C6:12 | B5:6 A5:2 G5:4 F#5:2 E5:2';
// ── Bridge: the leitmotif moved to G major (strings), the trumpet sings a third and a sixth below
const LEIT = 'D5:4 B5:6 A5:2 G5:2 A5:2 | B5:4 E5:4 G5:6 F#5:2 | E5:4 C6:6 B5:2 A5:2 G5:2 | A5:12 r:4';
const LEIT_UNDER = 'B4:4 G5:6 F#5:2 E5:2 F#5:2 | G5:4 B4:4 E5:6 D5:2 | C5:4 A5:6 G5:2 E5:2 E5:2 | F#5:12 r:4';
/** Last four bars of the bridge: string long notes push upward */
const C2_STR = 'B4+E5:16 | C5+G5:16 | C5+A5:16 | D5+F#5:8 F#5+A5:8';
/** Pre-chorus: strings rising in octaves */
const PRE_STR = 'E4+E5:8 G4+G5:8 | F#4+F#5:8 A4+A5:8 | G4+G5:8 B4+B5:8 | A4+A5:8 C5+C6:4 D5+D6:4';
/** A': low counterpoint for the strings, below the trumpet */
const A2_STR = 'B3:16 | G3:8 B3:8 | C4:16 | A3:8 D4:8 | B3:16 | E4:8 D4:8 | C4:8 E4:8 | D#4:16';

// ── Distorted guitar
/** Power-chord riff of the rival motif (root notes are written; the guitar adds the fifth and octave itself) */
const RIFF_INTRO = '!E2:2 B2:2 E3:6 D3:4 r:2 | !C2:2 G2:2 C3:6 D3:4 r:2 | !D2:2 A2:2 D3:6 E3:4 r:2 | !B2:2 r:2 B2:2 r:2 B2:1 B2:1 B2:1 B2:1 !B2:4';
const RIFF_C2 = '!E2:2 B2:2 E3:6 D3:4 r:2 | !C2:2 G2:2 C3:6 D3:4 r:2 | !A2:2 E3:2 A3:6 G3:4 r:2 | !D3:2 r:2 D3:2 r:2 D3:2 D3:2 !D3:4';
/** The bass version of the same riff (pressed into the low register) */
const RIFF_C2_BASS = '!E2:2 B1:2 E2:6 D2:4 r:2 | !C2:2 G1:2 C2:6 D2:4 r:2 | !A1:2 E2:2 A2:6 G2:4 r:2 | !D2:2 r:2 D2:2 r:2 D2:2 D2:2 !D2:4';
const power = (p: Chord[], rh: string) => bassline(p, rh, '1', { register: 40 });
/** Palm-muted chug: eighth notes, accents 3+3+2 */
const CHUG = 'X.x.x.X.x.x.X.x.';
const chug = (p: Chord[]) => bassline(p, CHUG, '1', { register: 40 });

// ── Spiccato sixteenth-note ostinato
const spic = (p: Chord[]) => bassline(p, 'xxxxxxxxxxxxxxxx', '1 5 8 5 1 5 8 5 1 5 8 5 3 5 8 5', { register: 59 });

// ── Distorted bass: held long notes (the eighth-note drive is left to the muted guitar and drums, which also saves CPU)
/** Verse: dotted quarter notes, following the 3+3+2 accents of the chug */
const b332 = (p: Chord[]) => bassline(p, 'X-----x-----X---', '1', { register: 40 });
/** Pre-chorus: quarter notes pushing forward */
const b4 = (p: Chord[]) => bassline(p, 'X---x---X---x---', '1', { register: 40 });
/** Chorus: together with the guitar's power chords */
const bCh = (p: Chord[]) => bassline(p, 'X-------X-----x-', '1', { register: 40 });
const bLong = (p: Chord[]) => bassline(p, 'X-------------x-', '1', { register: 40 });

// ── Drums
const g = (s: string) => rhythm(s.replace(/\s/g, ''));
const R16 = '................';
const r = (s: string, n: number) => s.repeat(n);
const DBL = 'XoxoXoxoXoxoXoxo';
// Verse: the kick follows the chug's 3+3+2, snare on beats two and four
const K_A = 'X.....X...X.....';
const S_A = '....X.......X...';
const H8 = 'x.x.x.x.x.x.x.x.';
// Chorus
const K_B = 'X.....x.X.x.....';
// First half of the bridge: a half-time feel
const K_H = 'X.........x.....';
const S_H = '........X.......';
// Denser snare (pre-chorus, second half of the bridge)
const S_BUILD = 'x...x...x...x...' + 'x.x.x.x.x.x.x.x.' + 'oxoxxxxxxxxxxxxx' + 'XxXxXxXxxxxxXXXX';
const FILL_S = '....X.......X.xx';

/** The double-kick sections are kept at low velocity so the low end does not smear into a haze */
const dbl = (n: number) => scaleVelocity(g(r(DBL, n)), 0.7);
const kick = sequence(g(r(K_A, 8)), dbl(12), g(r(K_B, 8) + r(K_H, 4)), dbl(4), g(r(K_B, 6)), dbl(2));
const snare = g(r(S_A, 7) + FILL_S + r(S_A, 7) + FILL_S + S_BUILD + r(S_A, 7) + FILL_S + r(S_H, 4) + S_BUILD + r(S_A, 7) + 'x.x.x.x.xxxxXXXX');
const hat = g(r(H8, 8) + r(R16, 8) + r(R16, 4) + r(R16, 8) + r(R16, 8) + r(R16, 8));
const ride = g(r(R16, 8) + r(H8, 8) + r(R16, 4) + r(R16, 8) + r('x...x...x...x...', 4) + r(R16, 4) + r(R16, 8));
const ohat = g(r(R16, 8) + r(R16, 8) + r(R16, 4) + r(H8, 8) + r(R16, 8) + r(H8, 8));
const cr = (bars: number, every: number, strong = true) => Array.from({ length: bars }, (_, i) => (i % every === 0 ? (strong ? 'X' : 'x') : '.') + '.'.repeat(15)).join('');
const crash = g(cr(8, 8) + cr(8, 4) + cr(4, 4) + cr(8, 2) + cr(4, 4, false) + cr(4, 4) + cr(8, 1));
/** Reversed cymbal: starts 19 steps (about 1.6 seconds) before the chorus */
const swell = g(r(R16, 18) + '.............x..' + R16 + r(R16, 14) + '.............x..' + R16 + r(R16, 8));
/** The tom fill at the end of B' */
const toms = sequence(rest(43), 'r:8 G3:2 G3:2 D3:2 A2:2');

const song: Song = {
  title: '勁敵凱爾',
  description: '少年漫畫式的熱血對決：E 小調搖滾，破音吉他、雙大鼓與失真貝斯，小號唱勁敵動機，副歌轉 G 大調，橋段用主導動機寫兩人的友情。',
  bpm: 176,
  reverb: { size: 1.2, damp: 0.4, preDelay: 0.012, early: 0.3, mix: 0.85 },
  gain: 0.93,
  intro: [
    { name: '破音吉他', instrument: 'powerGtr', part: RIFF_INTRO, gain: 1.05, pan: -0.1, reverb: 0.15, params: { release: 0.12 } },
    { name: '失真貝斯', instrument: 'distBass', part: RIFF_INTRO, gain: 0.78, params: { release: 0.06 } },
    { name: '斷弓', instrument: 'spicc', part: sequence(rest(2), spic(chords('D | B'))), gain: 0.6, pan: 0.3, reverb: 0.2 },
    { name: '大鼓', instrument: 'kick', part: g('X.X...X.....X...' + 'X.X...X.....X...' + 'X.X...X.....X...' + 'X...X...XxxxXxxx'), gain: 0.55 },
    { name: '小鼓', instrument: 'snare', part: g(R16 + R16 + '............x.xx' + 'X...X...xxxxXXXX'), gain: 1.3, reverb: 0.15 },
    { name: '鈸', instrument: 'crash', part: g('X' + '.'.repeat(31) + 'x' + '.'.repeat(31)), gain: 0.9, reverb: 0.2 },
  ],
  tracks: [
    { name: '小號', instrument: 'trumpet', part: sequence(TA, TA2, rest(4), CH, scaleVelocity(melody(LEIT_UNDER), 0.8), rest(4), CH2), gain: 1.65, pan: 0.12, reverb: 0.32, params: { release: 0.14 } },
    { name: '弦樂旋律', instrument: 'strings', part: sequence(rest(8), A2_STR, PRE_STR, rest(8), LEIT, C2_STR, transpose(melody(CH2), 12)), gain: 0.68, pan: -0.2, reverb: 0.4, params: { attack: 0.08, release: 0.35 } },
    { name: '弦樂長音', instrument: 'strings', part: sequence(rest(20), pad(pBpad, { center: 58, size: 3 }), scaleVelocity(pad(pC1, { center: 58, size: 3 }), 0.7), pad(pC2, { center: 58, size: 3 }), pad(pBpad, { center: 58, size: 3 })), gain: 0.4, pan: 0.15, reverb: 0.5, params: { attack: 0.25, release: 0.5 } },
    { name: '斷弓', instrument: 'spicc', part: sequence(rest(8), spic(pA), spic(pPre), scaleVelocity(spic(pB), 0.7), rest(4), spic(pC2), spic(pB)), gain: 0.6, pan: 0.3, reverb: 0.2 },
    { name: '破音吉他', instrument: 'powerGtr', part: sequence(rest(8), power(pA, 'X-----------x-x-'), power(pPre, 'X-x-x-x-X-x-x-x-'), power(pB, 'X-------X-----x-'), rest(4), RIFF_C2, power(pB, 'X-------X-----x-')), gain: 0.95, pan: -0.1, reverb: 0.15, params: { release: 0.12 } },
    { name: '悶音吉他', instrument: 'muteGtr', part: sequence(chug(pA), rest(36)), gain: 1.7, pan: 0.1, reverb: 0.1, params: { release: 0.06 } },
    { name: '失真貝斯', instrument: 'distBass', part: sequence(b332(pA), b332(pA), b4(pPre), bCh(pB), bLong(pC1), RIFF_C2_BASS, bCh(pB)), gain: 0.78, params: { release: 0.06 } },
    { name: '大鼓', instrument: 'kick', part: kick, gain: 0.5 },
    { name: '小鼓', instrument: 'snare', part: snare, gain: 1.45, reverb: 0.15 },
    { name: '踩鈸', instrument: 'hat', part: hat, gain: 3, pan: 0.25, reverb: 0.1 },
    { name: '疊音鈸', instrument: 'ride', part: ride, gain: 1.4, pan: 0.3, reverb: 0.15 },
    { name: '開鈸', instrument: 'ohat', part: ohat, gain: 1.8, pan: 0.25, reverb: 0.12 },
    { name: '鈸', instrument: 'crash', part: crash, gain: 1, pan: -0.25, reverb: 0.2 },
    { name: '反向鈸', instrument: 'swell', part: swell, gain: 1, reverb: 0.2 },
    { name: '筒鼓', instrument: 'tom', part: toms, gain: 0.7, pan: -0.15, reverb: 0.15 },
  ],
};

export default song;
