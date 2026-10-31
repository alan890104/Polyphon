// Melodies and rhythms written as short strings.
//
// Melody:
//   'E5:4 D5:2 C5:2 | B4:8 r:8 |'   note:length in sixteenth-note steps, r is a rest, | is a bar line (each bar's length is checked)
//   'E5:4 D5 C5 B4'                  leave out the length to reuse the previous one
//   'C4+E4+G4:16'                    a chord (pitches sounding together)
//   '!E5:4 ?E5:2'                    ! accent, ? soft (ghost note)
//   'E5:4> G5:4'                     > glide into the next note (instruments that support glides)
//   'G4:8~ | G4:4'                   ~ ties into the next note of the same pitch, across bar lines too
//   'E5:4/3'                         fractional length (a triplet eighth note is 4/3)
//   '(E5:2 D5:2)*4 R*2'              parenthesized groups repeat; R is a full bar of rest; . is the same as r
//
// Rhythm: one character per step. X accent, x normal, o soft, . or - rest; spaces and | are ignored.

import { midi, type Pitch } from '../theory.ts';
import { stepsPerBar, VELOCITY, type Meter, type Note, type Part } from './part.ts';

/**
 * Parse a melody string.
 *
 * @example
 * melody('C5:4 E5 G5 C6 | B5:8 G5:8 |')
 * melody('G4:6 A4:2 B4:4 | D5:12 |', '3/4')
 */
export function melody(source: string, meter: Meter = 16): Part {
  const bar = stepsPerBar(meter);
  const notes: Note[] = [];
  let t = 0;
  let dur = 4;
  let barStart = 0;
  let barNo = 1;
  let lastR = false;
  /** The note a ~ holds on into the next one */
  let tied: Note | undefined;
  for (const raw of expandRepeats(source).split(/\s+/)) {
    if (!raw) continue;
    if (raw === '|') {
      // R is a complete bar by itself, so a bar line right after it needs no further check (the "R*3 |" style)
      if (lastR && Math.abs(t - barStart) < 1e-6) {
        lastR = false;
        continue;
      }
      if (Math.abs(t - barStart - bar) > 1e-6) throw new Error(`Bar ${barNo} is ${+(t - barStart).toFixed(3)} steps long, expected ${bar}: ...${source.slice(0, 60)}`);
      barStart = t;
      barNo++;
      continue;
    }
    if (raw === 'R') {
      if (tied) throw new Error(`A tie (~) must lead into the same note, not a rest: ${raw}`);
      const atBar = Math.abs(t - barStart) < 1e-6;
      t += bar;
      if (atBar) {
        barStart = t;
        barNo++;
      }
      lastR = atBar;
      continue;
    }
    lastR = false;
    let tok = raw;
    let v: number = VELOCITY.normal;
    if (tok[0] === '!') {
      v = VELOCITY.accent;
      tok = tok.slice(1);
    } else if (tok[0] === '?') {
      v = VELOCITY.ghost;
      tok = tok.slice(1);
    }
    const tie = tok.endsWith('~');
    if (tie) tok = tok.slice(0, -1);
    let glide = false;
    if (tok.endsWith('>')) {
      glide = true;
      tok = tok.slice(0, -1);
    }
    const [pitch, len] = tok.split(':');
    if (len) {
      const [a, b] = len.split('/');
      dur = b ? Number(a) / Number(b) : Number(a);
      if (!(dur > 0)) throw new Error(`Invalid duration: ${raw}`);
    }
    if (pitch === 'r' || pitch === '.') {
      if (tied || tie) throw new Error(`A tie (~) joins two notes of the same pitch, not a rest: ${raw}`);
    } else if (tied) {
      if (pitch.split('+').map(midi).join() !== tied.pitches.join()) throw new Error(`A tie (~) must lead into the same pitch: ${raw}`);
      tied.duration += dur;
      if (glide) tied.glide = true;
    } else notes.push({ time: t, duration: dur, pitches: pitch.split('+').map(midi), velocity: v, glide: glide || undefined });
    tied = tie ? notes[notes.length - 1] : undefined;
    t += dur;
  }
  if (tied) throw new Error('A tie (~) at the end of a melody has no note to lead into');
  return { notes, duration: t };
}

function expandRepeats(src: string): string {
  let s = src.replace(/\|/g, ' | ');
  // Expand parentheses from the inside out
  for (let guard = 0; guard < 50 && s.includes('('); guard++) {
    s = s.replace(/\(([^()]*)\)\*(\d+)/g, (_, body: string, n: string) => Array(Number(n)).fill(body).join(' '));
    s = s.replace(/\(([^()]*)\)(?!\*)/g, (_, body: string) => body);
  }
  // Repeat a single token: R*4, E5:2*3
  s = s.replace(/(\S+)\*(\d+)/g, (_, tok: string, n: string) => Array(Number(n)).fill(tok).join(' '));
  return s;
}

export interface RhythmOptions {
  /** Steps per character (default 1: each character is a sixteenth note) */
  step?: number;
  /** The pitch every hit plays (tuned drums, or any instrument); default: unpitched */
  pitch?: Pitch;
}

/**
 * Parse a rhythm: one character per step. X accent, x normal, o soft, . or - rest.
 *
 * @example
 * rhythm('X...x...X..xx...')            // a kick pattern
 * rhythm('x.x.x.x.', { pitch: 'G2' })   // a pitched pulse
 */
export function rhythm(pattern: string, { step = 1, pitch }: RhythmOptions = {}): Part {
  const m = pitch === undefined ? undefined : midi(pitch);
  const notes: Note[] = [];
  let t = 0;
  for (const ch of pattern) {
    if (ch === ' ' || ch === '|' || ch === '\n') continue;
    const v = ch === 'X' ? VELOCITY.accent : ch === 'x' ? VELOCITY.normal : ch === 'o' ? VELOCITY.ghost : 0;
    if (v) notes.push({ time: t, duration: step, pitches: m === undefined ? [] : [m], velocity: v });
    t += step;
  }
  return { notes, duration: t };
}
