// What each tooth and hammer of the comb is doing at a moment of the song: lifted by a perforation's edge as it arrives, released
// (the pluck) exactly when its note sounds, then ringing down. A pure function of song time, so any frame can be drawn on its own.

import type { Drum } from '../timeline.ts';
import type { DiscLayout } from './layout.ts';

/** One row's notes in seconds, in order */
interface RowNotes {
  times: Float64Array;
  velocities: Float32Array;
  /** Seconds each note lasts (its slot passes under the tip meanwhile) */
  holds: Float32Array;
  leads: Uint8Array;
}

export interface ToothMotion {
  /** Metres the tip is lifted (positive) or swung below its rest (negative) */
  deflection: number;
  /** 0-1: the warm flash at the tip as it is released, and the lamp showing through while the slot is under it */
  glint: number;
}

/** How a tooth or a hammer moves */
interface Swing {
  /** Seconds a perforation's edge takes to lift it before the release */
  lift: number;
  /** The tip's lift at full velocity (metres: a real tooth moves a fraction of this, but it has to read across a room) */
  reach: number;
  /** The visible ringing after the release */
  hz: number;
  /** Seconds */
  decay: number;
  /** Seconds the flash at the release takes to fade */
  flash: number;
  /** How bright the flash is */
  glint: number;
}

/** Teeth, from the longest (lowest) to the shortest: they ring faster and shorter as they go up */
const LOWEST_TOOTH: Swing = { lift: 0.075, reach: 0.0034, hz: 5.2, decay: 0.62, flash: 0.16, glint: 1 };
const HIGHEST_TOOTH: Swing = { ...LOWEST_TOOTH, hz: 9.5, decay: 0.32 };
/**
 * The drum hammers, by weight: the low drum's swings furthest and glows longest but dimmest, the high one's barely moves and
 * flicks. Their lifts are short, so a fast roll reads as separate strikes.
 */
const HAMMERS: Record<Drum, Swing> = {
  low: { lift: 0.04, reach: 0.0046, hz: 3.4, decay: 0.34, flash: 0.2, glint: 0.65 },
  mid: { lift: 0.032, reach: 0.0032, hz: 5.6, decay: 0.2, flash: 0.1, glint: 0.9 },
  high: { lift: 0.022, reach: 0.0017, hz: 9, decay: 0.1, flash: 0.045, glint: 0.7 },
};
/** The glint while a long note's slot passes under a tooth's tip */
const HOLD_GLINT = 0.28;

export class Plucks {
  private readonly rows: RowNotes[];
  private readonly swings: Swing[];
  private readonly drums: boolean[];

  /** `duration`: seconds one turn of the disc takes */
  constructor(layout: DiscLayout, duration: number) {
    const lists = layout.rows.map(() => [] as { time: number; velocity: number; hold: number; lead: boolean }[]);
    for (const s of layout.slots) lists[s.row].push({ time: s.at * duration, velocity: s.velocity, hold: s.hold * duration, lead: s.lead });
    this.rows = lists.map((list) => ({
      times: Float64Array.from(list, (x) => x.time),
      velocities: Float32Array.from(list, (x) => x.velocity),
      holds: Float32Array.from(list, (x) => x.hold),
      leads: Uint8Array.from(list, (x) => Number(x.lead)),
    }));
    this.swings = layout.rows.map((r) => (r.drum ? HAMMERS[r.drum] : between(LOWEST_TOOTH, HIGHEST_TOOTH, r.pitch)));
    this.drums = layout.rows.map((r) => r.drum !== null);
  }

  get count(): number {
    return this.rows.length;
  }

  /** The tooth on `row` at song time `t`; `still` drops the lifting and ringing (reduced motion) and keeps the glint */
  motion(row: number, t: number, still: boolean, out: ToothMotion): ToothMotion {
    const { times, velocities, holds } = this.rows[row];
    const swing = this.swings[row];
    const i = lastAtOrBefore(times, t);
    let deflection = 0;
    let glint = 0;
    if (i >= 0) {
      const since = t - times[i];
      const v = strength(velocities[i]);
      if (!still) deflection = swing.reach * v * Math.exp(-since / swing.decay) * Math.cos(Math.PI * 2 * swing.hz * since);
      glint = swing.glint * v * Math.exp(-since / swing.flash);
      if (!this.drums[row] && since < holds[i]) glint = Math.max(glint, HOLD_GLINT * v);
    }
    // The next perforation's edge lifts the tip before releasing it, taking over from whatever ringing is left
    const next = i + 1;
    if (next < times.length && !still) {
      const ahead = times[next] - t;
      if (ahead < swing.lift) {
        const k = 1 - ahead / swing.lift;
        deflection = deflection * (1 - k) + swing.reach * strength(velocities[next]) * k * k;
      }
    }
    out.deflection = deflection;
    out.glint = Math.min(1, glint);
    return out;
  }

  /** Every note of the tracks (not the drums) heard in the `window` seconds up to song time `t` */
  forEachHeard(t: number, window: number, visit: (row: number, since: number, velocity: number, hold: number, lead: boolean) => void): void {
    for (let row = 0; row < this.rows.length; row++) {
      if (this.drums[row]) continue;
      const { times, velocities, holds, leads } = this.rows[row];
      for (let i = lastAtOrBefore(times, t); i >= 0 && t - times[i] < window; i--) visit(row, t - times[i], velocities[i], holds[i], leads[i] === 1);
    }
  }
}

/** Velocity as how hard a perforation's edge throws the tip: even the softest note moves it */
function strength(velocity: number): number {
  return 0.45 + 0.55 * velocity;
}

function between(a: Swing, b: Swing, k: number): Swing {
  const lerp = (x: number, y: number) => x + (y - x) * k;
  return { lift: lerp(a.lift, b.lift), reach: lerp(a.reach, b.reach), hz: lerp(a.hz, b.hz), decay: lerp(a.decay, b.decay), flash: lerp(a.flash, b.flash), glint: lerp(a.glint, b.glint) };
}

/** Index of the last time at or before `t`, or -1 */
function lastAtOrBefore(times: Float64Array, t: number): number {
  let low = 0;
  let high = times.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (times[mid] <= t) low = mid + 1;
    else high = mid;
  }
  return low - 1;
}
