// Mixer automation, scheduled ahead like the notes: sidechain pumping (a track dips at every hit of another, then swells back)
// and filter sweeps through a section.

import type { Sweep } from '../song.ts';

/** A ducking track's gain, and how it pumps */
export interface Pump {
  gain: AudioParam;
  /** How far it dips, 0-1 */
  depth: number;
  /** Seconds until it is back up */
  release: number;
}

/** The dip starts this far ahead of the hit, so the level is down when the hit lands (seconds) */
const LEAD = 0.004;

/** Level of a ducking track `t` seconds after a hit: down for the first quarter of the release, then swelling back (95% there at the end) */
export function duckLevel(depth: number, release: number, t: number): number {
  const swell = release / 4;
  return 1 - depth * Math.exp(-Math.max(0, t - swell) / swell);
}

/** Pump at a hit (context seconds). A hit before `from`, when a playback starts mid-swell, is picked up where it would be by then */
export function pump({ gain, depth, release }: Pump, hit: number, from = hit): void {
  const swell = release / 4;
  if (from > hit) gain.setValueAtTime(duckLevel(depth, release, from - hit), from);
  else gain.setTargetAtTime(1 - depth, hit - LEAD, LEAD / 3);
  gain.setTargetAtTime(1, Math.max(from, hit + swell), swell);
}

/** A sweep's breakpoints as [step, Hz], in order */
export function breakpoints(sweep: Sweep): [number, number][] {
  return Object.entries(sweep)
    .map(([step, hz]): [number, number] => [Number(step), Math.max(10, hz)])
    .sort((a, b) => a[0] - b[0]);
}

/** A sweep's cutoff at a step: held before the first breakpoint and after the last, gliding exponentially (evenly in pitch) between */
export function cutoffAt(points: [number, number][], step: number): number {
  const i = points.findIndex(([s]) => s > step);
  if (i === 0) return points[0][1];
  if (i < 0) return points[points.length - 1][1];
  const [s0, f0] = points[i - 1];
  const [s1, f1] = points[i];
  return f0 * Math.pow(f1 / f0, (step - s0) / (s1 - s0));
}

/** How long a sweep takes to get back to its start when its section repeats (seconds) */
const GLIDE = 0.02;

/**
 * Schedule one pass of a sweep through a section that starts at `start` (context seconds) and lasts `steps`, from `from` steps in.
 * A pass that follows another (`again`) glides back from where the last one ended: a filter retuned in one jump while it carries
 * sound thumps.
 */
export function sweep(cutoff: AudioParam, points: [number, number][], start: number, from: number, steps: number, step: number, again = false): void {
  const at = start + from * step;
  if (again) {
    cutoff.setValueAtTime(cutoffAt(points, steps), at);
    cutoff.exponentialRampToValueAtTime(cutoffAt(points, from), at + GLIDE);
  } else cutoff.setValueAtTime(cutoffAt(points, from), at);
  const knots = new Set(points.map(([s]) => Math.min(s, steps)).filter((s) => s > from));
  for (const s of knots) cutoff.exponentialRampToValueAtTime(cutoffAt(points, s), start + s * step);
}
