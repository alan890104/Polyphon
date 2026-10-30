// Wild `shadow`, Umbral Hollow: the eternal-night forest deep under the continent, where the Umbral Society guards its last secret.
// B harmonic minor, 3/4 waltz, 96 BPM. It should be mysterious and pretty, like a ball with no audience, not a horror film.
// Core motif: F#5 G5 F#5 (an upper neighbor tone, dotted quarter + eighth + quarter) then falling to D5 B4, like a sigh.
// The cello's motif leaps up a minor sixth (B3 -> G4, E4 -> C5), and is also the minor-key version of the main theme's major-sixth leap.
// A (16 bars): the music box sings the waltz, pizzicato strings play "oom, pah, pah". In the last 8 bars the bass descends chromatically B A# A G# G (a lament bass), the cello counterpoints in the middle register, and the glass harmonica holds long notes up high.
// B (16 bars): the cello takes over the melody, the harmony goes back and forth between Em and the Neapolitan sixth chord C/E (the bass stays still while the B above changes to C), and the clarinet blows long G -> F# notes in the low register.
// C (8 bars): the plucked chords stop, leaving only a heartbeat in the B bass; Bm and C major triads alternate, the clarinet sways between B and C along with them, the celesta plays an up-and-down figure, and the glass harmonica slows the main motif F# G F# into whole-bar long notes.
// A': the waltz returns; in the last 8 bars the celesta gently follows the music box in unison; in the second-to-last bar it turns to a C major triad again, stopping on F#7 and leading back to the beginning.
// Crickets run throughout; a low bell is struck at the start of each of the B and C sections.

import { arpeggio, bassline, chords, melody, pad, rest, roots, scaleVelocity, sequence, strum, type Song } from 'polyphon';

const M = 12;
const P = (s: string) => chords(s, M);
const R = (n: number) => rest(n, M);

// ── Harmony
const cA1 = 'Bm | Bm | Em | F#7 | Bm | G | C#m7b5 | F#7';
const cA2 = 'Bm | Bm/A# | Bm/A | E/G# | G | Em | F#7 | Bm';
const cB = 'Em | C/E | Em | C/E | Bm/F# | G | C | F#7 | Em | C/E | Bm/D | G | C/E | A#dim7 | Bm/F# | F#7';
const cC = 'Bm | C | Bm | C | Em | C | A#dim7 | F#7';
const cA3 = 'Bm | Bm/A# | Bm/A | E/G# | G | Em | C | F#7';

// ── Music box melody
const A1 = 'F#5:6 G5:2 F#5:4 | D5:4 B4:8 | E5:6 F#5:2 E5:4 | C#5:4 A#4:8 | B4:4 D5:4 F#5:4 | B5:6 A#5:2 B5:4 | G5:4 F#5:4 E5:4 | F#5:12';
const A2 = 'F#5:6 G5:2 F#5:4 | D5:4 B4:8 | F#5:6 E5:2 D5:4 | B4:4 E5:4 G#5:4 | B5:6 A5:2 G5:4 | E5:6 F#5:2 G5:4 | A#5:4 C#6:4 E6:4 | D6:4 B5:8';
/** The end of A': the Neapolitan C major triad, then stopping on the dominant chord */
const A3 = 'F#5:6 G5:2 F#5:4 | D5:4 B4:8 | F#5:6 E5:2 D5:4 | B4:4 E5:4 G#5:4 | B5:6 A5:2 G5:4 | E5:6 F#5:2 G5:4 | G5:4 E5:4 C6:4 | C#6:6 B5:2 A#5:4';

/** The cello's counterpoint in A2 / A' (middle register, moving only on the melody's long notes) */
const CELLO_CTR = 'B3:8 C#4:4 | D4:12 | C#4:8 B3:4 | B3:12 | D4:8 E4:4 | G4:8 B3:4 | E4:8 C#4:4 | F#3:12';
const CELLO_CTR3 = 'B3:8 C#4:4 | D4:12 | C#4:8 B3:4 | B3:12 | D4:8 E4:4 | G4:8 B3:4 | E4:8 G4:4 | F#4:6 E4:2 C#4:4';

// ── B: cello melody (leaping up a minor sixth)
const CELLO_B = [
  'B3:4 G4:6 F#4:2 | E4:4 C5:8 | B4:6 A4:2 G4:4 | G4:4 E4:8',
  'F#4:4 D5:6 C#5:2 | B4:12 | G4:4 C5:4 E5:4 | C#5:6 A#4:2 F#4:4',
  'B3:4 G4:6 F#4:2 | E4:4 C5:6 B4:2 | B4:6 A4:2 F#4:4 | G4:4 D4:8',
  'E4:6 G4:2 C5:4 | C#5:6 A#4:2 G4:4 | F#4:6 D4:2 B3:4 | A#3:4 C#4:4 E4:4',
].join(' | ');
/** Clarinet in the low register: long notes on G and F# (a sigh from a minor sixth to a fifth) */
const CLAR_B = 'G3:12 | G3:12 | G3:12 | G3:8 A3:4 | F#3:12 | G3:12 | G3:12 | F#3:12 | G3:12 | G3:12 | F#3:12 | G3:6 B3:6 | G3:12 | G3:12 | F#3:12 | F#3:12';

// ── C: an enigmatic section
const CEL_C = 'B5:2 D6:2 F#6:4 r:4 | G6:2 E6:2 C6:4 r:4 | B5:2 D6:2 F#6:2 B6:2 A#6:4 | G6:6 E6:2 C6:4 | B5:4 G5:4 E5:4 | E5:4 G5:4 C6:4 | C#6:4 A#5:4 G5:4 | F#5:2 E5:2 C#5:2 A#4:2 F#4:4';
/** Glass harmonica: the main motif F# G F# slowed down, then all the way down */
const GLASS_C = 'F#5:12 | G5:12 | F#5:12 | E5:12 | B4:12 | C5:12 | C#5:12 | A#4:12';
const CLAR_C = 'B3:12 | C4:12 | B3:12 | C4:12 | B3:12 | C4:12 | C#4:12 | C#4:12';

/** Glass harmonica's long notes in the A section (across bars, written without bar lines) */
const GLASS_A = sequence(R(4), melody('D6:24 C#6:24', M), melody('F#6:36 E6:12 D6:12 E6:24 D6:12', M));
const GLASS_A3 = sequence(R(4), melody('D6:24 C#6:24', M), melody('F#6:36 E6:12 D6:12 E6:12 C6:12 C#6:12', M));

const pA1 = P(cA1);
const pA2 = P(cA2);
const pB = P(cB);
const pC = P(cC);
const pA3 = P(cA3);

const OOM = 'x-----......';
const PAH = '....x...x...';

const song: Song = {
  title: '暮影幽境',
  description: '地底永夜森林的圓舞曲。音樂盒、撥奏弦樂、大提琴與玻璃琴，B 和聲小調，神秘但好看。',
  bpm: 96,
  meter: M,
  reverb: { size: 3.5, damp: 0.7, preDelay: 0.03, early: 0.35, mix: 0.9 },
  delay: { steps: 6, feedback: 0.3, tone: 2200, mix: 0.6 },
  gain: 1.3,
  tracks: [
    { name: '音樂盒', instrument: 'musicbox', part: sequence(melody(A1, M), melody(A2, M), R(16), R(8), melody(A1, M), melody(A3, M)), gain: 1.6, pan: 0.15, reverb: 0.4, delay: 0.12 },
    {
      name: '撥奏低音',
      instrument: 'pizzBass',
      part: sequence(
        bassline(pA1, OOM, '1', { register: 35 }),
        bassline(pA2, OOM, '1', { register: 35 }),
        scaleVelocity(bassline(pB, OOM, '1', { register: 35 }), 0.85),
        scaleVelocity(bassline(P('Bm | Bm | Bm | Bm | Bm | Bm | Bm | F#'), OOM, '1', { register: 35 }), 0.6),
        bassline(pA1, OOM, '1', { register: 35 }),
        bassline(pA3, OOM, '1', { register: 35 }),
      ),
      gain: 0.75,
      reverb: 0.2,
    },
    {
      name: '大提琴聲部',
      instrument: 'celli',
      part: sequence(
        roots(pA1, { register: 42, fifth: true, velocity: 0.5 }),
        roots(pA2, { register: 42, fifth: true, velocity: 0.55 }),
        roots(pB, { register: 42, fifth: true, velocity: 0.5 }),
        // In the C section a C chord moves over B's pedal bass: long notes would clash here, so they give way to the plucked strings
        R(8),
        roots(pA1, { register: 42, fifth: true, velocity: 0.55 }),
        roots(pA3, { register: 42, fifth: true, velocity: 0.6 }),
      ),
      gain: 0.38,
      pan: -0.2,
      reverb: 0.4,
      params: { attack: 0.25, release: 0.6 },
    },
    {
      name: '撥奏和弦',
      instrument: 'pizz',
      part: sequence(
        strum(pA1, PAH, { center: 62, size: 3, spread: 0.01 }),
        strum(pA2, PAH, { center: 62, size: 3, spread: 0.01 }),
        scaleVelocity(strum(pB, PAH, { center: 60, size: 3, spread: 0.01 }), 0.7),
        R(8),
        strum(pA1, PAH, { center: 62, size: 3, spread: 0.01 }),
        strum(pA3, PAH, { center: 62, size: 3, spread: 0.01 }),
      ),
      gain: 0.8,
      pan: -0.2,
      reverb: 0.3,
    },
    { name: '大提琴', instrument: 'cello', part: sequence(R(8), melody(CELLO_CTR, M), melody(CELLO_B, M), R(8), R(8), melody(CELLO_CTR3, M)), gain: 0.95, pan: -0.3, reverb: 0.4 },
    { name: '單簧管', instrument: 'clarinet', part: sequence(R(16), melody(CLAR_B, M), melody(CLAR_C, M), R(16)), gain: 0.4, pan: 0.3, reverb: 0.4 },
    { name: '玻璃琴', instrument: 'glass', part: sequence(scaleVelocity(GLASS_A, 0.6), R(16), melody(GLASS_C, M), scaleVelocity(GLASS_A3, 0.6)), gain: 0.55, pan: 0.35, reverb: 0.55, delay: 0.2 },
    {
      name: '鋼片琴',
      instrument: 'celesta',
      part: sequence(R(32), arpeggio(pC, '0 1 2 3 2 1', { step: 2, center: 67, velocity: 0.6 }), R(16)),
      gain: 0.5,
      pan: -0.35,
      reverb: 0.45,
      delay: 0.15,
    },
    { name: '鋼片琴旋律', instrument: 'celesta', part: sequence(R(32), melody(CEL_C, M), R(8), scaleVelocity(melody(A3, M), 0.7)), gain: 0.6, pan: 0.25, reverb: 0.5, delay: 0.2 },
    { name: '鐘', instrument: 'bell', part: sequence(R(16), melody('!E3:12', M), R(15), melody('B3:12', M), R(23)), gain: 1, pan: -0.1, reverb: 0.5 },
    { name: '蟲鳴', instrument: 'crickets', part: melody('C4:672', M), gain: 0.55, reverb: 0.15, params: { attack: 3, release: 3 } },
  ],
};

export default song;
