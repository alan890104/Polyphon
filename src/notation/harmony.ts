// Chord progressions, and the parts that grow out of them: pads, arpeggios, bass lines, sustained roots and strums.

import { midi, parseChord, voiceChord, type ChordInfo, type Pitch } from '../theory.ts';
import { stepsPerBar, VELOCITY, type Meter, type Note, type Part } from './part.ts';

/** A chord placed in time (steps) */
export interface Chord extends ChordInfo {
  time: number;
  duration: number;
}

/**
 * Parse a chord progression. Bars are separated by |, and the chords in a bar share it equally;
 * lengths can also be written out ('C:12 G:4'). '%' holds the previous chord for one more bar.
 *
 * @example
 * chords('Am | F | C G | E7')
 * chords('Dm:12 A7:4 | %')
 */
export function chords(source: string, meter: Meter = 16): Chord[] {
  const bar = stepsPerBar(meter);
  const out: Chord[] = [];
  let t = 0;
  for (const cell of source.split('|')) {
    const toks = cell.trim().split(/\s+/).filter(Boolean);
    if (!toks.length) continue;
    const explicit = toks.some((x) => x.includes(':'));
    const each = bar / toks.length;
    for (const tok of toks) {
      const [sym, len] = tok.split(':');
      const d = explicit ? Number(len ?? 0) || each : each;
      if (sym === '%') {
        if (out.length) out[out.length - 1].duration += d;
      } else out.push({ ...parseChord(sym), time: t, duration: d });
      t += d;
    }
  }
  return out;
}

/** Total length of a progression, in steps */
export const chordsDuration = (progression: Chord[]): number => {
  const last = progression[progression.length - 1];
  return last ? last.time + last.duration : 0;
};

export interface PadOptions {
  /** The register the voicing centers on (default C4) */
  center?: Pitch;
  /** Notes per chord (default: every chord tone) */
  size?: number;
  velocity?: number;
  /** Steps of silence before each chord change */
  gap?: number;
}

/** Sustained chords (pads, string sections, choirs, organ), voiced to move smoothly */
export function pad(progression: Chord[], { center = 60, size, velocity = VELOCITY.normal, gap = 0 }: PadOptions = {}): Part {
  let prev: number[] | undefined;
  const notes = progression.map((c) => {
    const m = voiceChord(c, { center, previous: prev, size });
    prev = m;
    return { time: c.time, duration: c.duration - gap, pitches: m, velocity };
  });
  return { notes, duration: chordsDuration(progression) };
}

export interface ArpeggioOptions {
  /** Steps per pattern character (default 2: eighth notes) */
  step?: number;
  /** The register the voicing centers on (default E4) */
  center?: Pitch;
  /** Notes per chord voicing (default: every chord tone) */
  size?: number;
  velocity?: number;
  /** Accent every Nth note */
  accent?: number;
}

/**
 * Arpeggio: the pattern picks chord tones by digit (0 is the lowest; past the number of chord tones it climbs an octave);
 * '.' is a rest, '-' holds the previous note. The pattern restarts on every chord.
 *
 * @example
 * arpeggio(chords('C | Am'), '0 1 2 1')
 * arpeggio(chords('C | Am'), '0-12 3.21', { step: 1, center: 'C5' })
 */
export function arpeggio(progression: Chord[], pattern: string, { step = 2, center = 64, size, velocity = VELOCITY.normal, accent }: ArpeggioOptions = {}): Part {
  const pat = pattern.replace(/\s+/g, '');
  const notes: Note[] = [];
  let prev: number[] | undefined;
  for (const c of progression) {
    const vc = voiceChord(c, { center, previous: prev, size });
    prev = vc;
    let k = 0;
    for (let s = 0; s < c.duration - 1e-6; s += step, k++) {
      const ch = pat[k % pat.length];
      if (ch === '.') continue;
      if (ch === '-') {
        if (notes.length) notes[notes.length - 1].duration += step;
        continue;
      }
      const idx = parseInt(ch, 36);
      const n = vc.length;
      const m = vc[idx % n] + 12 * Math.floor(idx / n);
      const acc = accent && k % accent === 0 ? 1.15 : 1;
      notes.push({ time: c.time + s, duration: Math.min(step, c.duration - s), pitches: [m], velocity: Math.min(1, velocity * acc) });
    }
  }
  return { notes, duration: chordsDuration(progression) };
}

/** What to stack above the bass: prefer a perfect fifth; if there is none (diminished chord, inversion, passing bass), look in turn for a sixth, a fourth, a third */
const ABOVE = [7, 8, 9, 5, 4, 3, 6];

/** The chord's bass note, placed within a fifth below to a fifth above the register */
function bassNote(c: Chord, register: number): number {
  let low = register + ((c.bass - (register % 12) + 12) % 12);
  if (low > register + 7) low -= 12;
  return low;
}

export interface RootsOptions {
  /** Where the bass sits: notes land within a fifth below to a fifth above this pitch (default C2) */
  register?: Pitch;
  /** Stack one more chord tone on top (usually an open fifth) */
  fifth?: boolean;
  velocity?: number;
}

/** Sustained bass notes: one per chord, held for the whole chord; a repeated bass note continues without re-attacking */
export function roots(progression: Chord[], { register = 36, fifth = false, velocity = 0.8 }: RootsOptions = {}): Part {
  const reg = midi(register);
  const notes: Note[] = [];
  for (const c of progression) {
    // Passing bass (a slash bass that is not a chord tone): just follows the bass, with no fifth stacked (stacking it would clash with the chord)
    const pcs = new Set(c.intervals.map((i) => (c.root + i) % 12));
    const low = bassNote(c, reg);
    const m = [low];
    if (fifth && pcs.has(c.bass)) {
      const up = ABOVE.find((k) => pcs.has((c.bass + k) % 12));
      if (up !== undefined) m.push(low + up);
    }
    const last = notes[notes.length - 1];
    if (last && last.pitches.join() === m.join() && last.time + last.duration === c.time) last.duration += c.duration;
    else notes.push({ time: c.time, duration: c.duration, pitches: m, velocity });
  }
  return { notes, duration: chordsDuration(progression) };
}

export interface BasslineOptions {
  /** Where the bass sits: the chord's bass lands within a fifth below to a fifth above this pitch (default C2) */
  register?: Pitch;
  velocity?: number;
}

/**
 * Bass line: the rhythm is a rhythm string that repeats every bar ('-' holds), and the line lists the scale degrees used in turn:
 * 1 the chord's bass, 3 the chord's third, 5 the fifth, 8 an octave up, -8 an octave down, b7 / 7 / 2 / 4 / 6, b2 (Phrygian), -5 / -4 below.
 *
 * @example
 * bassline(chords('C | Am | F | G'), 'x.x.x.x.x.x.x.x.', '1 5 8 5')
 */
export function bassline(progression: Chord[], rhythm: string, line = '1', { register = 36, velocity = VELOCITY.normal }: BasslineOptions = {}): Part {
  const rh = rhythm.replace(/[\s|]/g, '');
  const steps = line.trim().split(/\s+/);
  const reg = midi(register);
  const notes: Note[] = [];
  let li = 0;
  for (const c of progression) {
    const low = bassNote(c, reg);
    // Other degrees are counted from the root, placed at the nearest position above the bass
    const rootAbove = low + ((c.root - c.bass + 12) % 12);
    for (let s = 0; s < c.duration; s++) {
      const ch = rh[(c.time + s) % rh.length];
      if (ch === '-') {
        if (notes.length) notes[notes.length - 1].duration += 1;
        continue;
      }
      if (ch !== 'x' && ch !== 'X' && ch !== 'o') continue;
      const deg = steps[li++ % steps.length];
      let m: number;
      if (deg === '1') m = low;
      else if (deg === '8') m = low + 12;
      else if (deg === '-8') m = low - 12;
      else {
        m = rootAbove + degreeOffset(deg, c);
        if (!deg.startsWith('-')) while (m < low) m += 12;
      }
      notes.push({ time: c.time + s, duration: 1, pitches: [m], velocity: ch === 'X' ? 1 : ch === 'o' ? 0.5 : velocity });
    }
  }
  return { notes, duration: chordsDuration(progression) };
}

function degreeOffset(deg: string, c: ChordInfo): number {
  const fifth = c.intervals.includes(6) && !c.intervals.includes(7) ? 6 : c.intervals.includes(8) ? 8 : 7;
  const map: Record<string, number> = { '1': 0, b2: 1, '2': 2, b3: 3, '3': c.third || 4, '4': 5, b5: 6, '5': fifth, b6: 8, '6': 9, b7: 10, '7': 11, '8': 12, '10': 12 + (c.third || 4), '-5': -5, '-4': -7, '-b7': -2, '-7': -1, '-8': -12 };
  const v = map[deg];
  if (v === undefined) throw new Error(`Unrecognized bass scale degree: ${deg}`);
  return v;
}

export interface StrumOptions {
  /** The register the voicing centers on (default Bb3) */
  center?: Pitch;
  /** Strings per strum (default 5) */
  size?: number;
  /** Seconds between strings (default 0.014) */
  spread?: number;
  velocity?: number;
}

/** Strummed chords: the rhythm repeats every bar, x down-stroke, X heavy, o soft, '-' holds */
export function strum(progression: Chord[], rhythm: string, { center = 58, size = 5, spread = 0.014, velocity = VELOCITY.normal }: StrumOptions = {}): Part {
  const rh = rhythm.replace(/[\s|]/g, '');
  const notes: Note[] = [];
  let prev: number[] | undefined;
  for (const c of progression) {
    const vc = voiceChord(c, { center, previous: prev, size });
    prev = vc;
    for (let s = 0; s < c.duration; s++) {
      const ch = rh[(c.time + s) % rh.length];
      if (ch === '-') {
        if (notes.length) notes[notes.length - 1].duration += 1;
        continue;
      }
      if (ch !== 'x' && ch !== 'X' && ch !== 'o') continue;
      notes.push({ time: c.time + s, duration: 1, pitches: vc, velocity: ch === 'X' ? 1 : ch === 'o' ? 0.5 : velocity, strum: spread });
    }
  }
  return { notes, duration: chordsDuration(progression) };
}
