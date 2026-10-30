// "Void Crown Mass": the fight against the Void Crown cult, a cult that wants to open the seal (scouts, priests, the high priest).
// D minor, 4/4, 152 BPM. The signature is the Phrygian lowered second Eb: the theme's first phrase A4 -> D5 -> Eb5 -> D5, like a suppressed sigh.
// The low strings' sixteenth-note ostinato uses accents of 3+3+3+3+2+2, hiding an asymmetric drive inside four-four time.
// Sections (32 bars, about 50 seconds):
//   A   Strings sing the theme, the celesta layered faintly an octave above; the string pad only holds the chords, so the melody stands in front
//   A'  Trumpets and horns take the theme, brass and male choir shout briefly on the accents, and the snare joins
//   B   Mass: the female choir and full-stops organ sing a chorale of long notes, the strings switch to arpeggios, the taiko spreads out
//   C   Ritual and the rise: only the drone, chains and monks chanting the sigh motif; in the last four bars the theme motif is pushed up step by step, and a snare roll leads back to A

import { arpeggio, bassline, chords, pad, rest, rhythm, scaleVelocity, sequence, slice, strum, type Part, type Song } from 'polyphon';

// ── Harmony
const cA = 'Dm | F | Gm | A7 | Dm | F | Eb:8 A7:8 | Dm';
const cB = 'Bb | Gm | Eb | A | Bb | C | Eb | A7sus4:8 A7:8';
const cC = 'Dm | Dm | Eb/D | Dm | Dm | Eb | F | A7';
const A = chords(cA);
const B = chords(cB);
const C = chords(cC);
const C2 = chords('Dm | Eb | F | A7');

// ── Melody
/** Theme: a sigh (Eb -> D), descent, climbing to G5, landing on the leading tone C#5; the second phrase rushes to A5 and goes home through an Eb major triad */
const THEME = 'A4:4 D5:4 Eb5:6 D5:2 | C5:4 Bb4:4 A4:8 | Bb4:4 D5:4 G5:6 F5:2 | E5:4 F5:2 E5:2 C#5:8 | A4:4 D5:4 Eb5:6 D5:2 | F5:4 G5:4 A5:8 | G5:4 F5:2 Eb5:2 D5:4 C#5:4 | D5:12 r:4';
/** Chorale: long notes, moving up to Bb5, finally stopping on a suspended A5 */
const HYMN = 'F5:8 D5:8 | G5:8 Bb5:8 | G5:8 Eb5:8 | E5:8 C#5:8 | F5:8 D5:4 F5:4 | G5:8 E5:4 G5:4 | Bb5:8 G5:4 Eb5:4 | A5:16';
/** The rise: the sigh motif is pushed up step by step, and finally climbs up to A5 along A7 */
const CLIMB = 'A4:4 D5:4 Eb5:4 D5:4 | Bb4:4 Eb5:4 F5:4 Eb5:4 | C5:4 F5:4 G5:4 F5:4 | C#5:4 E5:4 G5:4 A5:4';
/** Soprano in the ritual section: a long line stretched above the monks */
const HALO = 'F5:8 A5:8 | D6:16 | Eb6:8 D6:4 C6:4 | D6:16';
/** The monks' sigh: D -> Eb -> D */
const SIGH = 'D3:4 Eb3:4 D3:8 | R | D3:4 Eb3:4 D3:4 C3:4 | D3:16';

// ── Low strings ostinato: sixteenth notes with 3+3+3+3+2+2 accents, upper neighbor on steps 13-14 and lower neighbor on the last step
const OST: Record<string, [number, number, number]> = { D: [50, 1, -2], Eb: [51, 2, -1], F: [53, 2, -2], G: [55, 2, -2], A: [45, 1, -1], Bb: [46, 2, -1], C: [48, 2, -2] };
const ACC = [0, 3, 6, 9, 12, 14];
function ost(r: string): Part {
  const [root, up, low] = OST[r];
  const notes = Array.from({ length: 16 }, (_, i) => ({ time: i, duration: 1, pitches: [i === 12 || i === 13 ? root + up : i === 15 ? root + low : root], velocity: ACC.includes(i) ? 1 : 0.5 }));
  return { notes, duration: 16 };
}
const osts = (...rs: string[]) => sequence(...rs.map(ost));
const OST_A = sequence(osts('D', 'F', 'G', 'A', 'D', 'F'), slice(ost('Eb'), 0, 8), slice(ost('A'), 8, 16), ost('D'));
const OST_B = osts('Bb', 'G', 'Eb', 'A', 'Bb', 'C', 'Eb', 'A');
const OST_C2 = osts('D', 'Eb', 'F', 'A');

// ── Percussion
const TAIKO_A = 'X.....x.....X.x.';
const TAIKO_B = 'X.......X.....x.';
const SNARE_A2 = '....x.......x..o';

const song: Song = {
  title: '虛冕彌撒',
  description: 'D 小調的黑彌撒。低音弦樂 3+3+2 的頑固音型推著走，弦樂與小號唱帶著降二級嘆息的主題，B 段女聲合唱與管風琴唱聖詠。',
  bpm: 152,
  gain: 0.62,
  reverb: { size: 2.6, damp: 0.55, preDelay: 0.03, early: 0.35, mix: 0.85 },
  intro: [
    { name: '鐘', instrument: 'bell', part: 'D4:16 | r:8 A3:8', gain: 0.8, pan: 0.2, reverb: 0.6 },
    { name: '管風琴踏板', instrument: 'organFull', part: 'D2:32', gain: 0.45, reverb: 0.45, params: { release: 0.4 } },
    { name: '修士', instrument: 'chant', part: 'D3:4 Eb3:4 D3:8 | r:8 A2:8', gain: 0.85, reverb: 0.5 },
    { name: '太鼓', instrument: 'taiko', part: rhythm('X...............|X.....x.....XxXX', { pitch: 36 }), gain: 0.8, reverb: 0.2 },
    { name: '反向鈸', instrument: 'swell', part: rhythm('................|...X............'), gain: 0.6, reverb: 0.3 },
  ],
  tracks: [
    // ── Main melody
    { name: '弦樂主題', instrument: 'strings', part: sequence(THEME, THEME, rest(8), rest(4), CLIMB), gain: 1.15, pan: 0.1, reverb: 0.35, params: { attack: 0.03, release: 0.25, bright: 1.2 } },
    { name: '鋼片琴', instrument: 'celesta', part: sequence(scaleVelocity(sequence(THEME), 0.8), rest(24)), transpose: 12, gain: 0.35, pan: 0.35, reverb: 0.5 },
    { name: '小號', instrument: 'trumpets', part: sequence(rest(8), THEME, rest(8), rest(4), CLIMB), gain: 0.75, pan: -0.1, reverb: 0.35, params: { release: 0.12 } },
    { name: '法國號', instrument: 'horns', part: sequence(rest(8), THEME, rest(16)), transpose: -12, gain: 0.55, pan: -0.3, reverb: 0.4, params: { release: 0.15 } },
    { name: '女聲聖詠', instrument: 'choir', part: sequence(rest(16), HYMN, rest(8)), gain: 1.0, pan: 0.05, reverb: 0.5, params: { attack: 0.12 } },
    { name: '管風琴聖詠', instrument: 'organFull', part: sequence(rest(16), HYMN, rest(8)), gain: 0.55, pan: -0.1, reverb: 0.45 },
    { name: '修士', instrument: 'chant', part: sequence(rest(24), SIGH, rest(4)), gain: 0.9, reverb: 0.55 },
    { name: '女高音', instrument: 'soprano', part: sequence(rest(24), HALO, rest(4)), gain: 0.6, pan: 0.15, reverb: 0.6 },
    // ── Harmony
    { name: '弦樂和聲', instrument: 'strPad', part: sequence(scaleVelocity(pad(A, { center: 57, size: 3 }), 0.6), scaleVelocity(pad(A, { center: 57, size: 3 }), 0.75), rest(12), scaleVelocity(pad(C2, { center: 57, size: 3 }), 0.8)), gain: 0.8, pan: -0.2, reverb: 0.4 },
    { name: '銅管重音', instrument: 'brassStab', part: sequence(rest(8), strum(A, 'X..X..X.........', { center: 57, size: 4, spread: 0 }), rest(12), strum(C2, 'X..X..X...X..X..', { center: 57, size: 4, spread: 0 })), gain: 0.6, pan: -0.15, reverb: 0.35 },
    { name: '男聲重音', instrument: 'menChoir', part: sequence(rest(8), strum(A, 'X-.X-.X-....o-o-', { center: 57, size: 3, spread: 0 }), rest(16)), gain: 0.8, pan: 0.2, reverb: 0.4, params: { attack: 0.02, release: 0.15 } },
    { name: '合唱和聲', instrument: 'menChoir', part: sequence(rest(16), scaleVelocity(pad(B, { center: 55, size: 3 }), 0.7), rest(8)), gain: 0.7, pan: -0.2, reverb: 0.5 },
    { name: '弦樂琶音', instrument: 'spicc', part: sequence(rest(16), arpeggio(B, '0 1 2 3 2 1 2 1', { step: 2, center: 64, size: 4 }), rest(8)), gain: 0.5, pan: 0.3, reverb: 0.3 },
    // ── Bass
    { name: '頑固音型', instrument: 'spicc', part: sequence(OST_A, OST_A, OST_B, rest(4), OST_C2), gain: 0.75, pan: -0.1, reverb: 0.2 },
    { name: '低音大提琴', instrument: 'contrabass', part: sequence(bassline(A, 'x-------x-------', '1 5', { register: 38 }), bassline(A, 'x-------x-------', '1 5', { register: 38 }), bassline(B, 'x-------x-------', '1 5', { register: 38 }), bassline(C, 'x---------------', '1', { register: 38 })), gain: 0.75 },
    { name: '管風琴踏板', instrument: 'organFull', part: sequence(rest(16), bassline(B, 'x---------------', '1', { register: 38 }), bassline(C, 'x---------------', '1', { register: 38 })), gain: 0.3, reverb: 0.4 },
    // ── Percussion
    { name: '太鼓', instrument: 'taiko', part: sequence(rhythm(TAIKO_A.repeat(15) + 'X.....x.....XxXX'), rhythm(TAIKO_B.repeat(8)), rhythm('X...............'.repeat(2) + 'X.......x.......'.repeat(2)), rhythm('X.....x.....X.x.'.repeat(3) + 'X.x.X.x.XxXxXXXX')), transpose: 0, gain: 0.8, reverb: 0.2 },
    { name: '定音鼓', instrument: 'timpani', part: sequence(bassline(A, 'x.....x.........', '1 5', { register: 38 }), bassline(A, 'x.....x.........', '1 5', { register: 38 }), bassline(B, 'x.......x.......', '1 5', { register: 38 }), rest(4), bassline(C2, 'x.....x.........', '1 5', { register: 38 })), gain: 0.7, reverb: 0.3 },
    { name: '軍鼓', instrument: 'field', part: sequence(rest(8), rhythm(SNARE_A2.repeat(7) + '....x...x.x.xxxx'), rhythm('....x.......x...'.repeat(8)), rest(4), rhythm('....x.......x...' + 'o.o.x.o.o.o.x.o.' + 'o.o.o.o.x.x.x.x.' + 'xxxxxxxxXXXXXXXX')), gain: 0.5, pan: 0.15, reverb: 0.3 },
    { name: '鐘', instrument: 'bell', part: sequence('D4:16 | R | R | R | D4:16 | R | R | R', 'D4:16 | R | R | R | D4:16 | R | R | R', 'Bb3:16 | R | R | R | Bb3:16 | R | R | R', 'D4:16 | R | R | R | R | R | R | R'), gain: 0.6, pan: 0.25, reverb: 0.6 },
    { name: '鎖鏈', instrument: 'chain', part: sequence(rest(24), rhythm('......x.........'.repeat(4)), rest(4)), gain: 0.5, pan: -0.35, reverb: 0.4 },
    { name: '鈸', instrument: 'crash', part: sequence(rhythm('X...............'), rest(7), rhythm('X...............'), rest(7), rhythm('X...............'), rest(11), rhythm('X...............'), rest(3)), gain: 0.55, reverb: 0.3 },
    { name: '反向鈸', instrument: 'swell', part: sequence(rest(15), rhythm('...X............'), rest(15), rhythm('...X............')), gain: 0.5, reverb: 0.3 },
  ],
};

export default song;
