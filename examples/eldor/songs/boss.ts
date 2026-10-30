// "Source Crystal Trial": the trials of the tower-top guardians of each region (the Forest Warden, the Lighthouse Guardian, the Forge Knight, the Wind Herald, the Dwarf King, the Thunder Seer).
// They are not villains but noble examiners: the music should be solemn and positive, a hard fight but an honorable one.
// D minor, the chorus turns to the relative major F; 4/4, 148 BPM.
// The theme's signature is a "short, short, long" fanfare call: D D leaping up a fifth to A (dotted eighth + sixteenth + half note).
// The harmony always has direction: the theme goes i -> bVII -> bVI -> V (Andalusian cadence), the answer i -> iv -> III -> V -> i;
//   the development passes through bII (Eb, Neapolitan) and C7 to push into F major; the chorus I -> IV -> vi -> V; the tail bVI -> iv -> V returns to the minor.
// Groove: the spiccato strings' "hoofbeat" figure (an eighth + two sixteenths, one group per beat), taiko on beats one and three, marching snare on beats two and four, timpani following the chord roots.
// Sections: intro (plays once) 4 bars of groove -> A theme: strings sing, horn an octave lower, 8 -> B development: long lines in the strings, the horn plays the call motif underneath, 8
//       -> chorus in F major: trumpets and female choir sing the major version of the theme, strings an octave higher, cymbal, 8 -> tail returns to D minor, 4
//       -> C breather: harp and horn play the theme solo, in the second half the strings take the answer and the drums crescendo all the way back to A, 8.

import { arpeggio, bassline, chords, chordsDuration, melody, pad, rest, rhythm, scaleDegree, scaleVelocity, sequence, transpose, type Chord, type Mode, type Part, type Song } from 'polyphon';

// ── Harmony
const cIntro = 'Dm | Bb | C | A7';
const cA = 'Dm | C | Bb | A | Dm | Gm | F A7 | Dm';
const cB = 'Gm | Eb | Bb | F | Gm | Eb | C | C7';
const cK = 'F | Bb | Dm | C | F | Bb | C7 | F';
const cT = 'Bb | Gm | A7sus4 | A7';
const cC = 'Dm | C | Bb | A | Dm | Gm | F A7 | A7';
const I = chords(cIntro), A = chords(cA), B = chords(cB), K = chords(cK), T = chords(cT), C = chords(cC);
const LOOP = chords(`${cA} | ${cB} | ${cK} | ${cT} | ${cC}`);

// ── Melody
/** Theme (D minor): the fanfare call D D A, then a descending response; the question stops on the dominant E, the answer rushes up to C6 and falls back to D */
const THEME_Q = '!D5:3 D5:1 A5:12 | G5:3 F5:1 E5:4 F5:4 G5:4 | Bb5:3 A5:1 G5:4 F5:4 D5:4 | E5:12 r:4';
const THEME_A = '!D5:3 D5:1 A5:12 | Bb5:3 A5:1 G5:4 A5:4 Bb5:4 | C6:3 Bb5:1 A5:4 G5:4 E5:4 | D5:12 r:4';
const THEME = melody(`${THEME_Q} | ${THEME_A}`);
/** Second half of the C section: a variant of the answer, finally stopping on the dominant chord (C# E A), leading back to the A section */
const THEME_A_OPEN = '!D5:3 D5:1 A5:12 | Bb5:3 A5:1 G5:4 A5:4 Bb5:4 | C6:3 Bb5:1 A5:4 G5:4 E5:4 | C#5:4 E5:4 A5:8';
/** B section strings: long lines, passing through Eb (bII) and climbing up, stopping on the E of C7 (the leading tone of F major) */
const LINE_B = 'D5:8 G5:8 | G5:6 F5:2 Eb5:4 Bb4:4 | D5:8 F5:8 | A5:6 G5:2 F5:4 C5:4 | Bb5:8 A5:4 G5:4 | G5:6 F5:2 G5:4 Bb5:4 | C6:8 Bb5:4 G5:4 | E5:12 r:4';
/** B section horn: plays the call motif under the strings */
const CALLS_B = '!G3:3 G3:1 D4:12 | R | !Bb3:3 Bb3:1 F4:12 | R | !G3:3 G3:1 D4:12 | R | !C4:3 C4:1 G4:12 | E4:4 G4:4 Bb4:8';
/** Chorus (F major): the same theme turned major, I -> IV -> vi -> V */
const CHORUS = '!F4:3 F4:1 C5:12 | Bb4:3 A4:1 G4:4 A4:4 Bb4:4 | D5:3 C5:1 Bb4:4 A4:4 F4:4 | G4:12 r:4 | !F4:3 F4:1 C5:12 | D5:3 C5:1 Bb4:4 C5:4 D5:4 | E5:3 D5:1 C5:4 Bb4:4 G4:4 | F4:12 r:4';
/** Tail: the horn slows the call motif down, leading back to D minor */
const TAIL_HORN = 'D4:8 F4:8 | G4:8 Bb4:8 | A4:16 | A4:8 C#5:4 E5:4';
/** The horn's harmony long notes in the chorus */
const K_HORN = 'A3:16 | Bb3:16 | A3:16 | G3:16 | A3:16 | D4:16 | C4:8 Bb3:8 | A3:16';

// ── Accompaniment
/** Hoofbeat figure: each beat an "eighth + two sixteenths", root notes on the first three beats, the fifth on the fourth beat (D3 to C#4) */
function gallop(p: Chord[], v = 1): Part {
  const notes: Part['notes'] = [];
  for (const c of p) {
    const r = 50 + ((((c.root - 50) % 12) + 12) % 12);
    const five = r + 7 > 61 ? r - 5 : r + 7;
    for (let s = 0; s < c.duration; s += 4) {
      const m = ((c.time + s) % 16) / 4 === 3 ? five : r;
      for (const [o, k] of [[0, 0.95], [2, 0.6], [3, 0.7]]) notes.push({ time: c.time + s + o, duration: 1, pitches: [m], velocity: k * v });
    }
  }
  return { notes, duration: chordsDuration(p) };
}

/** Harp glissando: scraping up along the mode's scale in one go */
function gliss(tonic: number, mode: Mode, from: number, n: number, dur = 4): Part {
  const d = dur / n;
  return { notes: Array.from({ length: n }, (_, i) => ({ time: i * d, duration: d * 3, pitches: [scaleDegree(tonic, mode, from + i)], velocity: 0.45 + (0.4 * i) / n })), duration: dur };
}
const GL_D = sequence(gliss(50, 'aeolian', 0, 16), 'r:12');
const GL_F = sequence(gliss(53, 'ionian', 0, 16), 'r:12');

/** Reversed cymbal: starts 1.6 seconds before the next strong beat */
const SWELL = 'r:0.2 C#3:15.8';

const song: Song = {
  title: '源晶試煉',
  description: 'D 小調的史詩戰鬥曲，副歌轉 F 大調。弦樂與法國號唱號角般的主題，斷弓弦樂的馬蹄音型，副歌由小號和女聲合唱接手：莊嚴、光明正大的試煉。',
  bpm: 148,
  gain: 0.8,
  reverb: { size: 2.4, damp: 0.4, preDelay: 0.025, early: 0.35, mix: 0.9 },
  intro: [
    { name: '斷弓弦樂', instrument: 'spicc', part: sequence(scaleVelocity(gallop(slice2(I, 0, 32)), 0.8), gallop(slice2(I, 32, 64))), gain: 0.8, pan: -0.25, reverb: 0.25 },
    { name: '銅管重音', instrument: 'brassStab', part: 'D4+F4+A4:2 r:14 | Bb3+D4+F4:2 r:14 | C4+E4+G4:2 r:14 | C#4+E4+A4:2 r:6 C#4+E4+A4:2 r:2 C#4+E4+A4:2 r:2', gain: 0.8, pan: 0.15, reverb: 0.35 },
    { name: '低音提琴', instrument: 'contrabass', part: bassline(I, 'x---------------', '1', { register: 38 }), gain: 0.7 },
    { name: '定音鼓', instrument: 'timpani', part: sequence(bassline(slice2(I, 0, 48), 'x.......x.......', '1 5', { register: 38 }), melody('A2:1 A2 A2 A2 A2 A2 A2 A2 A2 A2 A2 A2 !A2:4')), gain: 0.8, reverb: 0.3 },
    { name: '太鼓', instrument: 'taiko', part: rhythm('X.......X.......X.......X.......X.......X.......X...X...X.X.XXXX', { pitch: 36 }), gain: 0.75, reverb: 0.2 },
    { name: '反向鈸', instrument: 'swell', part: sequence(rest(3), SWELL), gain: 0.7, reverb: 0.3 },
  ],
  tracks: [
    {
      name: '弦樂旋律',
      instrument: 'strings',
      part: sequence(THEME, LINE_B, transpose(melody(CHORUS), 12), rest(8), melody(THEME_A_OPEN)),
      gain: 1.1,
      pan: 0.15,
      reverb: 0.35,
      params: { attack: 0.05, release: 0.3, vib: 10 },
    },
    {
      name: '法國號',
      instrument: 'horn',
      part: sequence(scaleVelocity(transpose(THEME, -12), 0.85), CALLS_B, K_HORN, TAIL_HORN, transpose(melody(THEME_Q), -12), rest(4)),
      gain: 0.9,
      pan: -0.2,
      reverb: 0.4,
    },
    { name: '小號', instrument: 'trumpets', part: sequence(rest(16), CHORUS, rest(12)), gain: 0.9, pan: 0.05, reverb: 0.35 },
    {
      name: '女聲合唱',
      instrument: 'choir',
      part: sequence(rest(16), CHORUS, 'D5+F5+Bb5:16 | D5+G5+Bb5:16 | D5+E5+A5:16 | C#5+E5+A5:16', rest(4), scaleVelocity(pad(chords('Dm | Gm | F A7 | A7'), { center: 67, size: 3 }), 0.7)),
      gain: 0.9,
      pan: -0.1,
      reverb: 0.5,
    },
    {
      name: '弦樂和聲',
      instrument: 'strPad',
      part: sequence(rest(8), scaleVelocity(pad(B, { center: 57, size: 3 }), 0.7), pad(K, { center: 57, size: 3 }), scaleVelocity(pad(T, { center: 57, size: 3 }), 0.8), scaleVelocity(pad(C, { center: 55, size: 3 }), 0.55)),
      gain: 0.65,
      reverb: 0.45,
      params: { release: 0.6 },
    },
    {
      name: '斷弓弦樂',
      instrument: 'spicc',
      part: sequence(scaleVelocity(gallop(A), 0.8), scaleVelocity(gallop(B), 0.85), gallop(K), gallop(T), rest(4), sequence(scaleVelocity(gallop(slice2(C, 64, 96)), 0.6), scaleVelocity(gallop(slice2(C, 96, 128)), 0.9))),
      gain: 0.8,
      pan: -0.25,
      reverb: 0.25,
    },
    {
      name: '豎琴',
      instrument: 'harp',
      part: sequence(rest(8), GL_D, rest(7), GL_F, rest(11), arpeggio(C, '0 1 2 3 4 3 2 1', { step: 2, center: 62 })),
      gain: 0.7,
      pan: 0.35,
      reverb: 0.45,
    },
    {
      name: '低音提琴',
      instrument: 'contrabass',
      part: sequence(bassline(LOOP, 'x-------x-------', '1 1', { register: 38 })),
      gain: 0.7,
      reverb: 0.2,
    },
    {
      name: '定音鼓',
      instrument: 'timpani',
      part: sequence(
        bassline(A, 'x.......x.......', '1 5', { register: 38 }),
        bassline(B, 'x...............', '1', { register: 38 }),
        bassline(K, 'x.......x.....x.', '1 5 5', { register: 38 }),
        bassline(chords('Bb | Gm'), 'x.......x.......', '1 5', { register: 38 }),
        melody('(A2:1)*16 | (A2:1)*12 !A2:4'),
        bassline(chords('Dm | C | Bb | A'), 'x...............', '1', { register: 38 }),
        bassline(chords('Dm | Gm'), 'x.......x.......', '1 5', { register: 38 }),
        melody('F2:4 F2 A2:4 A2 | (A2:1)*12 !A2:4'),
      ),
      gain: 0.8,
      reverb: 0.3,
    },
    {
      name: '太鼓',
      instrument: 'taiko',
      part: rhythm('X.......X.....x.'.repeat(7) + 'X.......X.x.X.XX' +
          'X...............'.repeat(4) + 'X.......X.......'.repeat(3) + 'X...X...X.x.XXXX' +
          ('X.x...X.X.x...X.'.repeat(3) + 'X.x...X.X.x.XXXX').repeat(2) +
          'X.......X.......'.repeat(3) + 'X...X...X.X.XXXX' +
          '................'.repeat(4) + 'X...............' + 'X.......X.......' + 'X...X...X...X...' + 'X.x.X.x.X.xxXXXX', { pitch: 36 }),
      gain: 0.45,
      reverb: 0.2,
    },
    {
      name: '行進軍鼓',
      instrument: 'field',
      part: rhythm('....X..o....X.oo'.repeat(7) + '....X..o..xxXXXX' +
          '................'.repeat(4) + '....X.......X...'.repeat(3) + 'o.o.o.o.x.x.xxXX' +
          '....X..o.o..X.oo'.repeat(7) + '....X..o.oxxXXXX' +
          '....X.......X...'.repeat(3) + 'xxxxxxxxXXXXXXXX' +
          '................'.repeat(5) + '....x.......x...' + '....X..o....X.oo' + 'o.o.o.o.x.x.xxXX'),
      gain: 1,
      pan: 0.15,
      reverb: 0.3,
    },
    {
      name: '鈸',
      instrument: 'crash',
      part: rhythm('X...............' + '................'.repeat(7) + 'x...............' + '................'.repeat(7) + ('X...............' + '................'.repeat(3)).repeat(2) + 'x...............' + '................'.repeat(11)),
      gain: 0.6,
      reverb: 0.4,
    },
    { name: '反向鈸', instrument: 'swell', part: sequence(rest(15), SWELL, rest(19), SWELL), gain: 0.6, reverb: 0.3 },
  ],
};

/** Take a stretch of a chord progression (step range) */
function slice2(p: Chord[], from: number, to: number): Chord[] {
  return p.filter((c) => c.time >= from && c.time < to).map((c) => ({ ...c, time: c.time - from }));
}

export default song;
