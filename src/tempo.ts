// Tempo through a song: changes at once (a new section) or gradually (ritardando, accelerando), and the clock that turns positions in
// the score into seconds.

import { stepsPerBar, type Meter } from './notation/part.ts';

/**
 * A change of tempo at the start of a bar, counted from 1 at the start of the song (the intro's bars first, then the body's).
 * `{ bar: 90, bpm: 66 }` is a new tempo from bar 90; `{ bar: 120, bpm: 80, over: 4 }` slows down evenly to 80 across bars 120 to 123.
 * A bar may be fractional to change mid-bar: 12.5 is halfway through bar 12.
 */
export interface TempoChange {
  bar: number;
  /** Beats (quarter notes) per minute */
  bpm: number;
  /** How many bars the change takes, gliding evenly from the tempo before it (default 0: at once) */
  over?: number;
}

/** A song's tempo through its score: positions in steps from the start of the song, as seconds and back */
export interface TempoClock {
  /** Seconds from the start of the song to a step */
  seconds(step: number): number;
  /** The step the song has reached after `seconds` */
  step(seconds: number): number;
  /** Beats per minute at a step */
  bpm(step: number): number;
}

/** A stretch of the score from `step` to the next span: the tempo starts at `bpm` and glides by `slope` per step (0: holds) */
interface Span {
  step: number;
  bpm: number;
  /** Seconds from the start of the song */
  seconds: number;
  /** Change in bpm per step */
  slope: number;
}

/** Seconds a step lasts at a tempo: 60 / bpm / 4 */
const stepSeconds = (bpm: number) => 15 / bpm;

/**
 * The clock of a song (its `bpm`, `tempo` and `meter`). Each pass of a looping body plays the same changes: the body's steps follow
 * the intro's, so a body step's time within its pass is `seconds(introSteps + step) - seconds(introSteps)`.
 *
 * @example
 * const clock = tempoClock({ bpm: 120, meter: '3/4', tempo: [{ bar: 9, bpm: 60 }] });
 * clock.seconds(8 * 12 + 4); // 12 + 0.25 * 4 = 13: eight bars at 120, then a beat at 60
 */
export function tempoClock({ bpm, tempo = [], meter }: { bpm: number; tempo?: readonly TempoChange[]; meter?: Meter }): TempoClock {
  const bar = stepsPerBar(meter);
  if (!(bpm > 0)) throw new Error(`Invalid tempo: ${bpm} bpm`);
  const spans: Span[] = [{ step: 0, bpm, seconds: 0, slope: 0 }];
  /** Hold or glide from the end of the last span to `step`, arriving at `target` bpm */
  const to = (step: number, target: number) => {
    const last = spans[spans.length - 1];
    if (step <= last.step) return;
    last.slope = (target - last.bpm) / (step - last.step);
    spans.push({ step, bpm: target, seconds: last.seconds + within(last, step - last.step), slope: 0 });
  };
  for (const change of [...tempo].sort((a, b) => a.bar - b.bar)) {
    const start = (change.bar - 1) * bar;
    const end = start + (change.over ?? 0) * bar;
    const before = spans[spans.length - 1];
    if (!(change.bpm > 0) || !(change.bar >= 1) || !(end >= start)) throw new Error(`Invalid tempo change: ${JSON.stringify(change)}`);
    if (start < before.step - 1e-9) throw new Error(`The tempo change at bar ${change.bar} starts before the change before it has finished`);
    to(start, before.bpm);
    if (end > start) to(end, change.bpm);
    else spans[spans.length - 1].bpm = change.bpm;
  }
  /** The last span starting at or before `value` (a MIDI file's rubato can make thousands) */
  const spanAt = (key: 'step' | 'seconds', value: number) => {
    let lo = 0;
    let hi = spans.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (spans[mid][key] <= value) lo = mid;
      else hi = mid - 1;
    }
    return spans[lo];
  };
  return {
    seconds: (step) => {
      const span = spanAt('step', step);
      return span.seconds + within(span, step - span.step);
    },
    step: (seconds) => {
      const span = spanAt('seconds', seconds);
      return span.step + stepsWithin(span, seconds - span.seconds);
    },
    bpm: (step) => {
      const span = spanAt('step', step);
      return span.bpm + span.slope * Math.max(0, step - span.step);
    },
  };
}

/** Seconds for the first `steps` of a span: the tempo glides linearly, so the time is the integral of 15 / bpm(step) */
function within({ bpm, slope }: Span, steps: number): number {
  if (Math.abs(slope) < 1e-12 || steps <= 0) return steps * stepSeconds(bpm);
  return (15 / slope) * Math.log(1 + (slope * steps) / bpm);
}

/** Steps a span covers in its first `seconds` (the inverse of `within`) */
function stepsWithin({ bpm, slope }: Span, seconds: number): number {
  if (Math.abs(slope) < 1e-12 || seconds <= 0) return seconds / stepSeconds(bpm);
  return (bpm / slope) * Math.expm1((slope * seconds) / 15);
}
