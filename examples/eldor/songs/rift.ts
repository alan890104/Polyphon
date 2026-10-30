// Wild `rift`, "Floating Royal City": The Rift, the wound left by the Night of the Shattered Heart. The earth hangs in the void and slowly crumbles, a phantom royal city hangs upside down in the sky,
// and giant chains moor the Rift Tower at the center. What is wanted here is not horror but an elegy: a world is being lost, and the one taking it away only "does not want to lose any more".
// E minor, 4/4, 70 BPM, in the same key and with the same harmonic technique as this region's wild encounter piece "Upside-Down Waltz", and it likewise opens by rising B E G.
// The otherworldly feel comes from displaced chords: Em is followed by Cm, Ab; every chord is consonant in itself, joined only by a shared note, and it always passes through B7 to get back to E minor.
// Sections (24 bars, about 82 seconds):
//   A   Cello solo elegy, held up by the string pad and double basses, with celesta fragments like slowly turning shards of rock
//   B   The harmony sinks into C minor, the glass harmonica sings the second section up high, a distant choir pad behind
//   A'  Strings take the theme an octave up with the cello singing along, harp arpeggios, and every two bars a reversed-piano intake of breath
// Beneath it all the wind of the void never stops; now and then a muffled crash of collapse in the distance, and the giant chains swaying gently.

import { arpeggio, bassline, chords, melody, midi, pad, rest, rhythm, roots, scaleVelocity, sequence, transpose, type Part, type Song } from 'polyphon';

const BPM = 70;
// ── Harmony
const A = chords('Em | Cmaj7 | Am7 | B7sus4:8 B7:8 | Em | Cm | Ab | B7');
const B = chords('Cm | Ab | Fm | G | Cm | Ab | Bb | B7');

// ── Melody
/** Elegy: B E G B rising, landing on the seventh of Cmaj7; in the second phrase E becomes Eb, reaching Eb5 over Cm and then coming back down along Ab to B7 */
const LAMENT = 'B3:4 E4:4 G4:4 B4:4 | B4:6 A4:2 G4:8 | C5:8 B4:4 A4:4 | E4:8 D#4:8 | B3:4 E4:4 G4:4 B4:4 | Eb5:8 D5:4 C5:4 | C5:6 Bb4:2 Ab4:4 Eb4:4 | F#4:4 A4:4 D#4:8';
/** The glass harmonica in the B section: long notes in C minor, finally stopping on the D# and F# of B7 */
const HIGH = 'G5:8 Eb5:8 | C5:8 Eb5:4 Ab5:4 | Ab5:8 F5:4 C5:4 | B4:8 D5:8 | G5:8 Eb5:8 | C6:8 Ab5:8 | Bb5:6 F5:2 D5:8 | D#5:8 F#5:8';

/** Reversed piano: the sample is 1.8 s long with its strongest point at the end, so it starts this many steps early and the loudest point falls exactly on the written beat */
const LEAD = Math.round(1.8 / (60 / BPM / 4));
function inhale(duration: number, list: [bar: number, notes: string][]): Part {
  return { notes: list.map(([bar, n]) => ({ time: bar * 16 - LEAD, duration: LEAD, pitches: n.split('+').map(midi), velocity: 0.85 })), duration: duration * 16 };
}

const song: Song = {
  title: '懸空的王城',
  description: 'E 小調的輓歌。大提琴獨奏，玻璃琴在 C 小調裡唱第二段；和弦在 Em、Cm、Ab 之間錯位地轉，虛空的風、遠處的崩塌與巨鏈。',
  bpm: BPM,
  gain: 0.8,
  reverb: { size: 4.2, damp: 0.45, preDelay: 0.04, early: 0.25, bloom: 0.3, mix: 0.95 },
  delay: { steps: 6, feedback: 0.4, tone: 2800, mix: 0.5 },
  intro: [
    { name: '虛空', instrument: 'void', part: 'C4:32', gain: 0.7, params: { attack: 1.5, release: 1 } },
    { name: '鋼片琴', instrument: 'celesta', part: 'r:8 B5:4 G5:4 | E6:8 r:8', gain: 0.45, pan: 0.3, reverb: 0.6, delay: 0.5 },
    { name: '倒放鋼琴', instrument: 'revPiano', part: inhale(2, [[2, 'E3+B3+G4']]), gain: 0.6, reverb: 0.4 },
  ],
  tracks: [
    // ── Melody
    { name: '大提琴', instrument: 'cello', part: sequence(LAMENT, rest(8), LAMENT), gain: 1.5, pan: -0.05, reverb: 0.45 },
    { name: '玻璃琴', instrument: 'glass', part: sequence(rest(8), HIGH, rest(8)), gain: 1.0, pan: 0.1, reverb: 0.55, delay: 0.25 },
    { name: '弦樂', instrument: 'strings', part: sequence(rest(16), transpose(melody(LAMENT), 12)), gain: 1.3, pan: 0.1, reverb: 0.45, params: { attack: 0.12, release: 0.5 } },
    // ── Harmony
    { name: '弦樂墊', instrument: 'strPad', part: sequence(scaleVelocity(pad(A, { center: 55, size: 3 }), 0.5), rest(8), scaleVelocity(pad(A, { center: 55, size: 3 }), 0.45)), gain: 0.8, pan: -0.2, reverb: 0.5 },
    { name: '合唱', instrument: 'choirOo', part: sequence(rest(8), scaleVelocity(pad(B, { center: 62, size: 3 }), 0.55), rest(8)), gain: 0.8, pan: -0.15, reverb: 0.7, params: { attack: 0.6 } },
    { name: '豎琴', instrument: 'harp', part: sequence(rest(16), arpeggio(A, '0 1 2 3 4 3 2 1', { step: 2, center: 60, size: 4 })), gain: 0.45, pan: -0.3, reverb: 0.45 },
    { name: '碎石', instrument: 'celesta', part: sequence(scaleVelocity(arpeggio(A, '4 . . 2 . . . 3 . . 5 . . . . .', { step: 1, center: 76, size: 4 }), 0.7), rest(8), scaleVelocity(arpeggio(A, '4 . . 2 . . . 3 . . 5 . . . . .', { step: 1, center: 76, size: 4 }), 0.55)), gain: 0.4, pan: 0.35, reverb: 0.6, delay: 0.5 },
    { name: '低音大提琴', instrument: 'contrabass', part: sequence(bassline(A, 'x---------------', '1', { register: 40 }), bassline(B, 'x---------------', '1', { register: 40 }), bassline(A, 'x---------------', '1', { register: 40 })), gain: 0.8, params: { attack: 0.4 } },
    { name: '大提琴聲部', instrument: 'celli', part: sequence(roots(A, { register: 45, fifth: true, velocity: 0.5 }), roots(B, { register: 45, fifth: true, velocity: 0.6 }), roots(A, { register: 45, fifth: true, velocity: 0.6 })), gain: 0.4, pan: 0.15, reverb: 0.5, params: { attack: 0.35, release: 0.8 } },
    // ── Void
    { name: '虛空', instrument: 'void', part: 'C4:384', gain: 0.55, params: { attack: 1, release: 1.5 } },
    { name: '崩塌', instrument: 'boom', part: sequence(rest(3), rhythm('........X.......'), rest(7), rhythm('X...............'), rest(7), rhythm('....X...........'), rest(4)), gain: 0.5, reverb: 0.8 },
    { name: '巨鏈', instrument: 'chain', part: sequence(rest(5), rhythm('......x.........'), rest(10), rhythm('..........x.....'), rest(7)), gain: 0.3, pan: 0.45, reverb: 0.7 },
    { name: '倒放鋼琴', instrument: 'revPiano', part: inhale(24, [[8, 'C3+G3+Eb4'], [12, 'C3+G3+Eb4'], [16, 'E3+B3+G4'], [18, 'C3+G3+E4'], [20, 'E3+B3+G4'], [22, 'Ab2+Eb3+C4']]), gain: 0.55, pan: 0.1, reverb: 0.45 },
  ],
};

export default song;
