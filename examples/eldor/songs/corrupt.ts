// "Corrupted": the fight against spirits corrupted by void crystals and robbed of themselves. Only by defeating one can it be pulled back out of the void crystal.
// Key: D harmonic minor, 128 BPM; the drums fall only on beat one (ground rumble) and beat three (low taiko), which sounds like a half-speed 64, heavy and dragging its feet.
// Theme: D F G# A, climbing from the tonic, with the harmonic minor's augmented second in the middle (F -> G#), like the corruption climbing up notch by notch;
//       the question goes i -> bVI -> iv -> V and stops on the dominant, the answer rushes to D6 and then lands via iv -> V -> i.
// The main melody is sung by the strings in unison on D5-D6, with the glass harmonica layered an octave above and every note a few cents off, so it sounds "right, but not quite right".
// The distorted bass plays the signature tritone on the tonic chord (D -> G# below -> A, climbing together with the melody's G# A), and on other chords plays the root and the fifth below;
// the spiccato cellos' eighth-note ostinato follows the chord roots (bass, octave, fifth, upper neighbor).
// Sections: G groove 4 bars -> A string theme 8 -> B female choir's lament (turning to Bb, F, C, with the bII Eb pushing back to the dominant) 8
//       -> C climax: the strings sing the theme, the female voices an octave lower, the glass harmonica an octave higher, drum fills 8 -> D disintegration: one chain rattle, then only the void, reversed piano, minor-second choir and fragments of out-of-tune glass harmonica, and finally the taiko crescendos back to the opening 4.

import { chords, melody, pad, rest, rhythm, scaleVelocity, sequence, slice, transpose, type Chord, type Part, type Song } from 'polyphon';

// ── Harmony
const G = chords('Dm | Bb Dm/A | Gm | A7');
const A = chords('Dm | Bb Dm/A | Gm | A | Dm | Gm | A7 | Dm');
const B = chords('Bb | F/A | Gm | A7 | Bb | C | Eb | A7');
const D = chords('Dm | Eb/D | Dm | A7b9');

// ── Melody
/** Question: D F G# A climbs up, Bb falls back to A, goes up and down on iv, stops on the E of the dominant chord */
const TQ = 'D5:4 F5:4 G#5:4 A5:4 | Bb5:8 A5:8 | G5:6 Bb5:2 A5:4 G5:4 | E5:12 r:4';
/** Answer: the same climb, rushing to D6, then all the way back down to the tonic */
const TA = 'D5:4 F5:4 G#5:4 A5:4 | D6:8 C6:4 Bb5:4 | A5:4 G5:4 F5:4 E5:4 | D5:12 r:4';
const THEME = melody(`${TQ} | ${TA}`);
/** The B-section lament (female voices): groups of two bars sequenced downward, climbing up at the Eb (bII), finally stopping on the dominant A */
const LAMENT = 'F5:6 G5:2 F5:4 D5:4 | C5:6 D5:2 C5:4 A4:4 | Bb4:4 D5:4 G5:8 | G5:4 F5:2 E5:6 r:4 | F5:6 G5:2 F5:4 D5:4 | E5:6 F5:2 E5:4 C5:4 | Eb5:6 F5:2 G5:4 Bb5:4 | A5:12 r:4';
/** Disintegration: the theme is only fragments */
const SHARDS = 'r:4 G#5:4 A5:8 | R | r:4 Eb5:4 D5:8 | r:8 C#5:8';

/** Out of tune: every note is a few cents off, the offsets cycling in order */
function warp(p: Part, cents: number[]): Part {
  return { notes: p.notes.map((e, i) => ({ ...e, pitches: e.pitches.map((x) => x + cents[i % cents.length] / 100) })), duration: p.duration };
}
const W1 = [9, -7, 12, -4, 6, -10];
const W2 = [34, -28, 20, -36, 8];

// ── Distorted bass: on the tonic chord D -> G# -> A (a tritone, then a semitone climb into the dominant), on other chords root -> fifth below (the root placed within G1-F#2)
/** The shape is written on C3 (root), F#2 (tritone), G2 (fifth below); on chords that are not D the tritone is swapped for the fifth below */
function bassMotif(p: Chord[], shape: string): Part {
  const s = melody(shape);
  return sequence(
    ...p.map((c) => {
      const low = 31 + ((((c.bass - 31) % 12) + 12) % 12);
      const part = transpose(slice(s, 0, c.duration), low - 48);
      if (c.bass === 2) return part;
      return { notes: part.notes.map((e) => ({ ...e, pitches: e.pitches.map((x) => (x === low - 6 ? low - 5 : x)) })), duration: part.duration };
    }),
  );
}
const HOLD = '!C3:6 C3:2 !F#2:4 G2:4';
const DRIVE = '!C3:3 C3:3 C3:2 !F#2:4 G2:2 C3:2';
const LONG = 'C3:12 r:4';

// ── Spiccato cellos: bass, octave, octave, fifth, bass, octave, upper neighbor, octave (neighbor: a semitone on D and A, a whole tone on the others)
function ostinato(p: Chord[], rate = 2): Part {
  const notes: Part['notes'] = [];
  const shape = [0, 12, 12, 7, 0, 12, -1, 12];
  for (const c of p) {
    const low = 36 + ((((c.root - 36) % 12) + 12) % 12);
    const nb = c.root === 2 || c.root === 9 ? 1 : 2;
    for (let s = 0, k = 0; s < c.duration; s += rate, k++) {
      const x = shape[k % 8];
      notes.push({ time: c.time + s, duration: rate, pitches: [low + (x < 0 ? 12 + nb : x)], velocity: k % 4 === 0 ? 0.95 : 0.7 });
    }
  }
  return { notes, duration: p.length ? p[p.length - 1].time + p[p.length - 1].duration : 0 };
}

// ── Reversed piano: a 1.8-second intake of breath, starting about 15.4 steps early, just filling up on the next strong beat
const INHALE = 'r:0.64 D3+A3+D4:15.36';
const INHALE_DARK = 'r:0.64 C#3+G3+Bb3:15.36';

const song: Song = {
  title: '蝕化',
  description: 'D 和聲小調的半速戰鬥曲。弦樂齊奏唱主題，走音的玻璃琴疊在高八度；失真貝斯的三全音與半速的地鳴、低音太鼓壓著拍子，中段由女聲唱哀歌。',
  bpm: 128,
  reverb: { size: 2.6, damp: 0.7, preDelay: 0.02, early: 0.25, mix: 0.85 },
  intro: [
    { name: '倒放鋼琴', instrument: 'revPiano', part: INHALE, gain: 0.9, reverb: 0.5 },
    { name: '虛空', instrument: 'void', part: 'C4:16', gain: 0.6, reverb: 0.2, params: { attack: 1.2, release: 2 } },
  ],
  tracks: [
    {
      name: '弦樂主旋律',
      instrument: 'strings',
      part: sequence(rest(4), THEME, rest(8), THEME, rest(4)),
      gain: 1.2,
      pan: 0.1,
      reverb: 0.4,
      params: { attack: 0.07, release: 0.35, vib: 12 },
    },
    {
      name: '玻璃琴',
      instrument: 'glass',
      part: sequence(rest(4), scaleVelocity(warp(transpose(THEME, 12), W1), 0.6), rest(8), scaleVelocity(warp(transpose(THEME, 12), W1), 0.7), warp(melody(SHARDS), W2)),
      gain: 0.9,
      pan: 0.3,
      reverb: 0.5,
      params: { attack: 0.08, release: 0.5 },
    },
    {
      name: '女聲',
      instrument: 'choir',
      part: sequence(rest(12), LAMENT, scaleVelocity(transpose(THEME, -12), 0.85), rest(4)),
      gain: 0.9,
      pan: -0.15,
      reverb: 0.5,
    },
    { name: '小二度音群', instrument: 'choirOo', part: sequence(rest(3), 'C#4+D4+A4:16', rest(24), 'D4+Eb4:48 C#4+D4:16'), gain: 0.7, pan: -0.25, reverb: 0.6 },
    {
      name: '暗墊',
      instrument: 'darkPad',
      part: sequence(scaleVelocity(pad(G, { center: 50, size: 3 }), 0.75), scaleVelocity(pad(A, { center: 50, size: 3 }), 0.6), scaleVelocity(pad(B, { center: 52, size: 3 }), 0.75), scaleVelocity(pad(A, { center: 50, size: 3 }), 0.7), scaleVelocity(pad(D, { center: 50, size: 3 }), 0.5)),
      gain: 0.65,
      reverb: 0.5,
      params: { release: 0.9 },
    },
    {
      name: '失真貝斯',
      instrument: 'distBass',
      part: sequence(bassMotif(G, HOLD), bassMotif(A, HOLD), scaleVelocity(bassMotif(B, LONG), 0.75), bassMotif(A, DRIVE), rest(3), bassMotif(chords('A7b9'), DRIVE)),
      gain: 0.55,
      reverb: 0.1,
      params: { cut: 1100, release: 0.08 },
    },
    {
      name: '斷弓大提琴',
      instrument: 'spicc',
      part: sequence(ostinato(G), ostinato(A), scaleVelocity(ostinato(B, 4), 0.85), ostinato(A), rest(4)),
      gain: 0.8,
      pan: -0.3,
      reverb: 0.25,
    },
    {
      name: '倒放鋼琴',
      instrument: 'revPiano',
      part: sequence(rest(3), INHALE, rest(15), INHALE, rest(8), INHALE, INHALE_DARK, INHALE, INHALE_DARK),
      gain: 0.8,
      pan: -0.1,
      reverb: 0.5,
    },
    {
      name: '地鳴',
      instrument: 'boom',
      part: rhythm('X...............'.repeat(20) + 'X.........x.....'.repeat(7) + 'X.........x.x...' + 'o...............o...............o...............x...............'),
      gain: 0.5,
      reverb: 0.15,
    },
    {
      name: '低音太鼓',
      instrument: 'taiko',
      part: rhythm('........X.......'.repeat(3) + '........X...o.o.' +
          ('........X.......'.repeat(3) + '........X.....o.').repeat(2) +
          '........x.......'.repeat(7) + '........x...o.o.' +
          ('........X.....o.'.repeat(3) + '........X.o.X.XX').repeat(2) +
          '................'.repeat(3) + 'o.o.o.o.x.x.xxXX', { pitch: 36 }),
      gain: 0.6,
      reverb: 0.2,
    },
    {
      name: '邊擊',
      instrument: 'rim',
      part: rhythm('....o.......x...'.repeat(12) + '............o...'.repeat(8) + '....o.......x.o.'.repeat(7) + '....o.......x.xo' + '................'.repeat(4)),
      gain: 0.45,
      pan: 0.3,
      reverb: 0.35,
    },
    { name: '鎖鏈', instrument: 'chain', part: sequence(rest(28), rhythm('X...............')), gain: 1.2, pan: 0.3, reverb: 0.45 },
    { name: '虛空', instrument: 'void', part: sequence(rest(28), 'C4:64'), gain: 0.7, reverb: 0.2, params: { attack: 2, release: 3 } },
  ],
};

export default song;
