// Tidesong Isles (`isles`): a water-element wild song. Coral reefs, a lighthouse, the ice fields of the northern shore, and a singing holy whale.
// G Mixolydian (F natural), 6/8, quarter note 150 (dotted quarter 100), a sailors' jig.
// Theme: the arpeggio rising from the G major triad (G, B, D), moved unchanged to the F major triad (C, A, F) in the next bar. I and bVII side by side give the salt of Mixolydian; every phrase ends with F to G.
// The tin whistle uses fast upper grace notes (a very short touch, then sliding back to the main note) for Irish-style ornaments; the accordion plays the off-beat on the second eighth note of each group, the guitar strums long-short-long-short, and the frame drum plays the bodhran's 6/8 pattern.
// Sections: A tin whistle solo jig
//      A2 the fiddle adds a harmony a third below, the accordion joins
//      W the holy whale's song: drums and guitar all drop out, long notes in E minor pentatonic. The morin khuur sings the whale song with big slides, a distant soprano answers, the glass harmonica and glass pad open up the space, the celesta like ice crystals
//      C everyone returns: a new melody starting from degree IV (C), higher and livelier; the fiddle in unison an octave lower
//      C' the accordion takes over the melody, the fiddle a third above
//      A3 the tin whistle returns, the fiddle an octave lower, the accordion singing harmony, and the frame drum's turnaround at the phrase end leads back to the beginning.

import { bassline, chords, melody, pad, rest, rhythm, roots, scaleVelocity, sequence, stack, strum, transpose, type Song } from 'polyphon';

const M = 12;
const m12 = (s: string) => melody(s, M);
const r12 = (bars: number) => rest(bars, M);

// ── Harmony
const cA = 'G | F | G | D7 | G | F | C | F:6 G:6';
const cC = 'C | G | F | G | C | Em | Am | F:6 G:6';
/** The glass pad's whale-song harmony: the C chord becomes add9, with the major seventh left to the glass harmonica */
const cWpad = 'Em | % | Cadd9 | % | G | % | D | % | Em | % | Cadd9 | % | Am7 | % | Dsus4 | D';

const pA = chords(cA, M);
const pC = chords(cC, M);
const pWpad = chords(cWpad, M);
const pIntro = chords('G | F', M);

// ── The tin whistle's jig (grace notes written as 0.5 step and then sliding to the main note)
const A_TUNE =
  'A5:0.5> G5:3.5 B5:2 D6:4 B5:2 | C6:4 A5:2 F5:4 A5:2 | G5:2 B5:2 D6:2 A6:0.5> G6:3.5 E6:2 | D6:2 C6:2 B5:2 A5:2 B5:0.5> A5:3.5 | ' +
  'A5:0.5> G5:3.5 B5:2 E6:0.5> D6:3.5 B5:2 | C6:4 A5:2 F5:4 A5:2 | E6:4 D6:2 C6:2 B5:2 A5:2 | F5:2 A5:2 C6:2 A5:0.5> B5:0.5> G5:5';
/** The fiddle in A2: mostly a third below, flipping above the whistle in the last bar */
const A_HARM = 'D5:4 G5:2 B5:4 G5:2 | A5:4 F5:2 C5:4 F5:2 | D5:2 G5:2 B5:2 D6:4 C6:2 | B5:2 A5:2 G5:2 F#5:6 | D5:4 G5:2 B5:4 G5:2 | A5:4 F5:2 C5:4 F5:2 | C6:4 B5:2 A5:2 G5:2 F5:2 | C5:2 F5:2 A5:2 B5:6';
/** C section: starting from degree IV, higher than the A section */
const C_TUNE =
  'F6:0.5> E6:3.5 G6:2 E6:4 D6:2 | B5:4 D6:2 G5:4 B5:2 | C6:4 F6:2 C6:4 A5:2 | B5:2 C6:2 D6:2 A6:0.5> G6:5.5 | ' +
  'E6:4 G6:2 E6:4 D6:2 | B5:4 E6:2 B5:4 G5:2 | A5:2 C6:2 E6:2 D6:2 C6:2 A5:2 | F5:2 A5:2 C6:2 A5:0.5> B5:0.5> G5:5';
/** The fiddle in C': a third above the accordion (an octave lower) */
const C_HARM = 'G5:4 B5:2 G5:4 F5:2 | D5:4 F5:2 B4:4 D5:2 | F5:4 A5:2 F5:4 C5:2 | D5:2 E5:2 F5:2 B5:6 | G5:4 B5:2 G5:4 F5:2 | D5:4 G5:2 D5:4 B4:2 | C5:2 E5:2 G5:2 F5:2 E5:2 C5:2 | A4:2 C5:2 E5:2 B4:6';

// ── The holy whale's song (4 bars per phrase)
const WHALE = melody(
  'E4:3> B4:15> A4:6> G4:6 r:18 | D4:3> D5:15> B4:6> A4:12 r:12 | E4:3> E5:6> G5:12> E5:6> D5:6> B4:9 r:6 | A4:6> E5:12> D5:6> A4:15 r:9',
  48,
);
const ECHO = melody('r:30 B5:3> E6:15 | r:36 A5:3> D6:9 | R | r:30 E6:6> D6:12', 48);
const HALO = melody('B5:24 | G5:24 | D6:24 | A5:24 | B5:24 | B5:24 | C6:24 | A5:24', 24);
const DEEP = melody('E2:24 | C2:24 | G2:24 | D2:24 | E2:24 | C2:24 | A1:24 | D2:24', 24);
const ICE8 = 'r:6 B6:2 E7:4 | R | r:3 D7:3 B6:6 | R | r:6 G6:2 D7:4 | R | r:3 E7:3 A6:6 | R';

// ── Frame drum (bodhran): the low is the open hand, the high is pressing on the drum skin
const FL = 43;
const FH = 50;
const bod = (low: string, high: string, fillLow: string, fillHigh: string) => stack(rhythm(low.repeat(7) + fillLow, { pitch: FL }), rhythm(high.repeat(7) + fillHigh, { pitch: FH }));
const bodA = bod('X.....X.....', '..x.x...x.xo', 'X.....X.X.X.', '..x.xx.x.xxx');
const bodC = bod('X.....X..o..', '.ox.xx.ox.xx', 'X.....X.X.X.', '.ox.xxxxxxXX');
const bodW = sequence(r12(15), rhythm('......ooxxXX', { pitch: FH }));

// ── Accompaniment patterns
const guitar = (p: ReturnType<typeof chords>) => strum(p, 'X---x-X---x-', { center: 55, size: 3, spread: 0.012 });
/** The accordion only plays the second eighth note of each group, and together with the guitar (1, 3, 4, 6) and the bass (1, 4) it forms the complete jig pulse; live-synthesized short notes are heavy on CPU, so it does not play every one */
const squeeze = (p: ReturnType<typeof chords>) => strum(p, '..x-....x-..', { center: 62, size: 3, spread: 0.002, velocity: 0.75 });

const song: Song = {
  title: '潮歌群島',
  description: 'G 混合利底亞的 6/8 水手吉格：錫哨、提琴、手風琴、吉他、框鼓；中段鼓聲全停，馬頭琴用滑音唱鯨歌，鋼片琴像冰晶。',
  bpm: 150,
  meter: M,
  gain: 1,
  reverb: { size: 1.4, damp: 0.3, preDelay: 0.012, early: 0.35, mix: 0.85 },
  delay: { steps: 6, feedback: 0.4, tone: 2400, mix: 0.6 },
  intro: [
    { name: '海浪', instrument: 'sea', part: m12('C4:24'), gain: 0.9, reverb: 0.15, params: { attack: 2, release: 2.5 } },
    { name: '吉他', instrument: 'nylon', part: guitar(pIntro), gain: 0.22, pan: -0.35, reverb: 0.25 },
    { name: '框鼓', instrument: 'frame', part: stack(rhythm('X.....X.....X.....X.X.X.', { pitch: FL }), rhythm('..x.x...x.x...x.x...x.xx', { pitch: FH })), gain: 0.45, reverb: 0.15 },
    { name: '錫哨', instrument: 'whistle', part: m12('R | r:6 D5:2 E5:2 F5:2'), gain: 0.8, pan: 0.15, reverb: 0.3, params: { attack: 0.03 } },
    { name: '低音', instrument: 'pizzBass', part: bassline(pIntro, 'x-----x-----', '1 5'), gain: 0.55 },
  ],
  tracks: [
    // Melody
    { name: '錫哨', instrument: 'whistle', part: sequence(m12(A_TUNE), m12(A_TUNE), r12(16), m12(C_TUNE), r12(8), m12(A_TUNE)), gain: 1, pan: 0.15, reverb: 0.3, delay: 0.06, params: { attack: 0.03 } },
    {
      name: '提琴',
      instrument: 'fiddle',
      part: sequence(r12(8), m12(A_HARM), r12(16), transpose(m12(C_TUNE), -12), m12(C_HARM), transpose(m12(A_TUNE), -12)),
      gain: 0.75,
      pan: -0.25,
      reverb: 0.3,
    },
    { name: '手風琴旋律', instrument: 'accordion', part: sequence(r12(40), transpose(m12(C_TUNE), -12), scaleVelocity(m12(A_HARM), 0.85)), gain: 0.8, pan: 0.3, reverb: 0.28 },
    // The holy whale's song
    { name: '鯨歌', instrument: 'morin', part: sequence(r12(16), WHALE, r12(24)), gain: 1, pan: 0.1, reverb: 0.6, delay: 0.25, params: { glide: 0.5, vib: 30, attack: 0.3, release: 0.8 } },
    { name: '遠方的回聲', instrument: 'soprano', part: sequence(r12(16), ECHO, r12(24)), gain: 0.55, pan: -0.3, reverb: 0.85, delay: 0.3, params: { glide: 0.35, attack: 0.4, release: 1 } },
    { name: '玻璃琴', instrument: 'glass', part: sequence(r12(16), HALO, r12(24)), gain: 0.5, reverb: 0.6, params: { attack: 1.2, release: 1.5 } },
    { name: '冰晶', instrument: 'celesta', part: sequence(r12(16), m12(ICE8), m12(ICE8), r12(24)), gain: 0.55, pan: 0.35, reverb: 0.55, delay: 0.45 },
    { name: '深海', instrument: 'contrabass', part: sequence(r12(16), DEEP, r12(24)), gain: 0.6, reverb: 0.4, params: { attack: 0.8, release: 1 } },
    { name: '玻璃墊', instrument: 'glassPad', part: sequence(r12(16), scaleVelocity(pad(pWpad, { center: 57 }), 0.8), r12(24)), gain: 0.7, reverb: 0.6, params: { attack: 1.5, release: 2 } },
    // Accompaniment
    { name: '吉他', instrument: 'nylon', part: sequence(guitar(pA), guitar(pA), r12(16), guitar(pC), guitar(pC), guitar(pA)), gain: 0.22, pan: -0.35, reverb: 0.25 },
    { name: '手風琴反拍', instrument: 'accordion', part: sequence(r12(8), squeeze(pA), r12(16), squeeze(pC), r12(8), squeeze(pA)), gain: 0.7, pan: 0.35, reverb: 0.25 },
    {
      name: '低音',
      instrument: 'pizzBass',
      part: sequence(bassline(pA, 'x-----x-----', '1 5'), bassline(pA, 'x-----x-----', '1 5'), r12(16), bassline(pC, 'x-----x---x-', '1 5 1'), bassline(pC, 'x-----x---x-', '1 5 1'), bassline(pA, 'x-----x---x-', '1 5 1')),
      gain: 0.65,
    },
    // Cello section: long open fifths on the chord bass (the whale-song section is left to the deep-sea double bass)
    { name: '大提琴聲部', instrument: 'celli', part: sequence(roots(pA, { register: 45, fifth: true, velocity: 0.5 }), roots(pA, { register: 45, fifth: true, velocity: 0.6 }), r12(16), roots(pC, { register: 45, fifth: true, velocity: 0.6 }), roots(pC, { register: 45, fifth: true, velocity: 0.65 }), roots(pA, { register: 45, fifth: true, velocity: 0.6 })), gain: 0.34, pan: -0.15, reverb: 0.35, params: { attack: 0.2, release: 0.5 } },
    { name: '框鼓', instrument: 'frame', part: sequence(bodA, bodA, bodW, bodC, bodC, bodC), gain: 0.45, reverb: 0.15 },
    // Ambience
    { name: '海浪', instrument: 'sea', part: m12('C4:672'), gain: 0.9, reverb: 0.15, params: { attack: 2, release: 2.5 } },
  ],
};

export default song;
