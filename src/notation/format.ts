// Parts written back as melody strings, the notation melody() reads: for notes that came from elsewhere (a voice, a MIDI file).

import { midi } from '../theory.ts';
import { stepsPerBar, VELOCITY, type Meter, type Note, type Part } from './part.ts';

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
/** Without a key signature: each black key as it is most often written (noteName's spelling) */
const PLAIN = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
/** Keys whose signatures have flats; the others but C major and A minor have sharps */
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'].map((t) => `${t} major`).concat(['D', 'G', 'C', 'F', 'Bb', 'Eb', 'Ab'].map((t) => `${t} minor`)));

/**
 * Write a part as a melody string, with a bar line after every bar; a note that crosses a bar line is tied over it. Black keys are
 * spelled as the key signature of `key` has them ('Eb major' writes Bb, 'E major' writes D#), or as noteName() does without one.
 * The notes must follow one another: notes that start together become a chord, and must end together.
 *
 * @example
 * formatMelody(melody('C5:4 E5 G5 C6 | B5:12 r:4 |')); // 'C5:4 E5 G5 C6 | B5:12 r:4 |'
 * formatMelody(part, '3/4', 'F major');
 */
export function formatMelody(part: Part, meter: Meter = 16, key?: string): string {
  const bar = stepsPerBar(meter);
  const name = speller(key);
  const tokens: string[] = [];
  /** The length in force: a token that leaves its length out reuses it */
  let length: number | undefined;
  let time = 0;

  /** Write a note (or a rest, without pitches) from `time`, splitting it at bar lines */
  const write = (pitches: string | null, duration: number, mark = '', glide = false) => {
    const end = time + duration;
    for (let first = true; time < end - 1e-9; first = false) {
      const barEnd = (Math.floor(time / bar + 1e-9) + 1) * bar;
      const piece = Math.min(end, barEnd) - time;
      const last = time + piece >= end - 1e-9;
      if (pitches === null && Math.abs(piece - bar) < 1e-9) tokens.push('R');
      else {
        const written = length !== undefined && Math.abs(piece - length) < 1e-9 ? '' : `:${formatLength(piece)}`;
        const body = pitches === null ? 'r' : `${first ? mark : ''}${pitches}`;
        tokens.push(`${body}${written}${pitches !== null && last && glide ? '>' : ''}${pitches !== null && !last ? '~' : ''}`);
        length = piece;
      }
      time += piece;
      if (Math.abs(time - barEnd) < 1e-9) tokens.push('|');
    }
  };

  for (const chord of chords(part.notes)) {
    const [{ time: start, duration, velocity, glide }] = chord;
    if (start < time - 1e-9) throw new Error(`Notes overlap at step ${+start.toFixed(3)}: a melody string holds one line`);
    if (start > time) write(null, start - time);
    const mark = velocity >= (VELOCITY.accent + VELOCITY.normal) / 2 ? '!' : velocity <= (VELOCITY.normal + VELOCITY.ghost) / 2 ? '?' : '';
    write(chord.flatMap((n) => n.pitches).map(name).join('+'), duration, mark, glide);
  }
  if (part.duration > time) write(null, part.duration - time);
  return tokens.join(' ');
}

/** Notes grouped by when they start, in order; a group must end together */
function chords(notes: readonly Note[]): Note[][] {
  const groups: Note[][] = [];
  for (const note of [...notes].sort((a, b) => a.time - b.time)) {
    const group = groups[groups.length - 1];
    if (group && Math.abs(group[0].time - note.time) < 1e-9) {
      if (Math.abs(group[0].duration - note.duration) > 1e-9) throw new Error(`Notes starting together at step ${+note.time.toFixed(3)} must end together`);
      group.push(note);
    } else groups.push([note]);
  }
  return groups;
}

/** A length in steps as the notation writes it: 4, or 4/3 for a triplet eighth */
function formatLength(steps: number): string {
  for (let denominator = 1; denominator <= 16; denominator++) {
    const numerator = steps * denominator;
    if (Math.abs(numerator - Math.round(numerator)) < 1e-6) return denominator === 1 ? `${Math.round(numerator)}` : `${Math.round(numerator)}/${denominator}`;
  }
  throw new Error(`A length of ${steps} steps cannot be written`);
}

/** Note names in a key: its signature's sharps or flats */
function speller(key?: string): (pitch: number) => string {
  const names = [...PLAIN];
  if (key) {
    const m = /^([A-Ga-g])([#b]?)\s+(major|minor)$/i.exec(key.trim());
    if (!m) throw new Error(`Unrecognized key: ${key} (write it as 'Eb major' or 'F# minor')`);
    const [tonic, mode] = [`${m[1].toUpperCase()}${m[2]}`, m[3].toLowerCase()];
    const plain = (tonic === 'C' && mode === 'major') || (tonic === 'A' && mode === 'minor');
    if (!plain) names.splice(0, 12, ...(FLAT_KEYS.has(`${tonic} ${mode}`) ? FLATS : SHARPS));
    // A minor key raises its sixth and seventh on the way up, with sharps or naturals: G# in A minor, C# in D minor
    const root = midi(`${tonic}4`) % 12;
    if (mode === 'minor') for (const degree of [9, 11]) names[(root + degree) % 12] = SHARPS[(root + degree) % 12];
  }
  return (pitch) => `${names[((pitch % 12) + 12) % 12]}${Math.floor(pitch / 12) - 1}`;
}
