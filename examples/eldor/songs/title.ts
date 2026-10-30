// Main theme "Eldor Overture": the leitmotif of the whole game.
// Motif: a major-sixth leap A4 -> F#5, followed by an echo of E5 D5 E5 ("the other side of the mountain"). The world map, the ending and the final battle all quote it.
// D major, 76 BPM. Harp arpeggios open -> the flute sings the first phrase -> the horn takes the second -> the strings sing the chorus (rising to a high point on B5) -> full orchestra (trumpets, choir, timpani, snare) -> the celesta coda returns to the opening.

import { arpeggio, bassline, chords, pad, rest, rhythm, roots, scaleVelocity, sequence, type Song } from 'polyphon';

// ── Main melody
const A1 = 'A4:4 F#5:6 E5:2 D5:2 E5:2 | F#5:4 B4:4 D5:6 C#5:2 | B4:4 G5:6 F#5:2 E5:2 D5:2 | E5:12 r:4';
const A2 = 'A4:4 F#5:6 E5:2 D5:2 E5:2 | F#5:4 A5:4 B5:6 A5:2 | G5:4 F#5:2 E5:2 E5:4 D5:2 E5:2 | D5:12 r:4';
const B = 'G5:6 F#5:2 E5:4 D5:4 | E5:6 F#5:2 E5:4 C#5:4 | C#5:6 D5:2 E5:4 F#5:4 | B5:8 A5:4 F#5:4 | G5:6 F#5:2 E5:4 B4:4 | E5:6 D5:2 C#5:4 E5:4 | D5:4 F#5:4 A5:8 | G5:4 F#5:4 E5:8';
const CODA = 'A5:4 F#6:6 E6:2 D6:2 E6:2 | D6:16 | A5:4 F#6:6 E6:2 D6:2 E6:2 | E6:12 r:4';
/** The horn's counterpoint during the chorus (long notes, moving downward) */
const B_HORN = 'B4:8 A4:8 | C#5:8 A4:8 | A4:16 | F#4:8 B4:8 | B4:8 G4:8 | A4:16 | A4:8 F#4:8 | B4:8 C#5:8';

// ── Harmony
const cA1 = 'D | Bm | G | A';
const cA2 = 'D | Bm | Em7 A7 | D';
const cB = 'G | A | F#m | Bm | Em | A/C# | D | Asus4 A';
const cCoda = 'D | G/D | D | Asus4 A';
const cIntro = 'D | Bm | G | Asus4 A';

const all = chords(`${cA1} | ${cA2} | ${cB} | ${cA1} | ${cA2} | ${cCoda}`);
const quiet = chords(`${cA1} | ${cA2}`);
const bridge = chords(cB);
const full = chords(`${cA1} | ${cA2}`);
const coda = chords(cCoda);
const intro = chords(cIntro);

const song: Song = {
  title: '艾爾多序曲',
  description: '主題曲。遼闊、帶一點鄉愁的英雄感：豎琴與長笛起頭，最後全樂團齊奏。',
  bpm: 76,
  reverb: { size: 2.8, damp: 0.4, preDelay: 0.025, early: 0.35, mix: 0.9 },
  intro: [
    { name: '豎琴', instrument: 'harp', part: arpeggio(intro, '0 1 2 3 4 3 2 1', { step: 2, center: 62 }), gain: 0.8, pan: -0.2, reverb: 0.45 },
    { name: '弦樂', instrument: 'strPad', part: scaleVelocity(pad(intro, { center: 57 }), 0.5), gain: 0.7, reverb: 0.5 },
    { name: '低音', instrument: 'contrabass', part: bassline(intro, 'x---------------', '1', { register: 38 }), gain: 0.6 },
    { name: '鐘琴', instrument: 'glock', part: 'r:12 A6:4 | R | r:12 F#6:4 | E6:8 r:8', gain: 0.5, pan: 0.3, reverb: 0.6 },
  ],
  tracks: [
    { name: '長笛', instrument: 'flute', part: sequence(A1, rest(24)), gain: 0.9, pan: 0.15, reverb: 0.45 },
    { name: '法國號', instrument: 'horn', part: sequence(rest(4), A2, B_HORN, rest(12)), transpose: -12, gain: 0.85, pan: -0.25, reverb: 0.5, params: { release: 0.14 } },
    { name: '弦樂旋律', instrument: 'strings', part: sequence(rest(8), B, rest(12)), gain: 0.85, pan: 0.2, reverb: 0.45, params: { attack: 0.12 } },
    { name: '小號', instrument: 'trumpets', part: sequence(rest(16), A1, A2, rest(4)), gain: 0.75, pan: 0.1, reverb: 0.4, params: { release: 0.14 } },
    { name: '法國號齊奏', instrument: 'horns', part: sequence(rest(16), A1, A2, rest(4)), transpose: -12, gain: 0.6, pan: -0.3, reverb: 0.45, params: { release: 0.14 } },
    { name: '鋼片琴尾聲', instrument: 'celesta', part: sequence(rest(24), CODA), gain: 0.7, pan: 0.25, reverb: 0.6 },
    { name: '豎琴', instrument: 'harp', part: arpeggio(all, '0 1 2 3 4 3 2 1', { step: 2, center: 62 }), gain: 0.7, pan: -0.35, reverb: 0.4 },
    {
      name: '弦樂墊',
      instrument: 'strPad',
      part: sequence(scaleVelocity(pad(quiet, { center: 57 }), 0.55), scaleVelocity(pad(bridge, { center: 57 }), 0.75), pad(full, { center: 57, size: 4 }), scaleVelocity(pad(coda, { center: 57 }), 0.5)),
      gain: 0.75,
      reverb: 0.45,
    },
    { name: '合唱', instrument: 'choirOo', part: sequence(rest(8), scaleVelocity(pad(bridge, { center: 62 }), 0.7), pad(full, { center: 64 }), rest(4)), gain: 0.55, reverb: 0.6 },
    {
      name: '低音',
      instrument: 'contrabass',
      part: sequence(bassline(quiet, 'x---------------', '1', { register: 38 }), bassline(bridge, 'x-------x-------', '1 5', { register: 38 }), bassline(full, 'x-------x---x---', '1 1 5', { register: 38 }), bassline(coda, 'x---------------', '1', { register: 38 })),
      gain: 0.8,
    },
    // Cello section: sustained open fifths above the bass, thickest when the full orchestra plays in unison
    { name: '大提琴聲部', instrument: 'celli', part: sequence(roots(quiet, { register: 45, fifth: true, velocity: 0.5 }), roots(bridge, { register: 45, fifth: true, velocity: 0.7 }), roots(full, { register: 45, fifth: true, velocity: 0.85 }), roots(coda, { register: 45, fifth: true, velocity: 0.55 })), gain: 0.45, pan: -0.15, reverb: 0.45, params: { attack: 0.2, release: 0.6 } },
    { name: '定音鼓', instrument: 'timpani', part: sequence(rest(7), '!D3:1 ?D3:1 D3:1 D3:1 D3:1 D3:1 D3:1 D3:1 !A2:8', bassline(bridge, 'x...............', '1', { register: 38 }), bassline(full, 'X.......x.....x.', '1 5 1', { register: 38 }), rest(4)), gain: 0.8, reverb: 0.4 },
    { name: '軍鼓', instrument: 'field', part: sequence(rest(16), rhythm('x..xx.x.x..xx.x.'.repeat(7) + 'x.x.xxxxXxxxXXXX'), rest(4)), gain: 0.55, pan: 0.1, reverb: 0.35 },
    { name: '鈸', instrument: 'crash', part: sequence(rest(16), rhythm('X...............'), rest(7), rhythm('x...............'), rest(3)), gain: 0.7, reverb: 0.4 },
  ],
};

export default song;
