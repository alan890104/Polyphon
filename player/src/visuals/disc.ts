// The song as a music-box disc, drawn the way the covers draw it: each note a perforation, its angle the time it sounds
// (counter-clockwise from 12 o'clock, so the disc turning clockwise plays them in order under the comb), its distance from the
// centre its pitch within the song's range, on 18 rows; drums on a ring of their own; the tune punched in brass.

import { alpha, mix, type Theme } from './themes.ts';
import type { NoteTimeline, TimedNote } from './timeline.ts';

const TURN = Math.PI * 2;

/** Radii as fractions of the disc's radius (the covers' proportions) */
export const DISC = {
  rim: 0.97,
  outer: 0.88,
  inner: 0.38,
  hits: 0.3,
  hub: 0.22,
  spindle: 0.045,
} as const;

/** Rows of pitches, like the tracks a polyphon's comb reads */
const ROWS = 18;
/** Width of a perforation, as a fraction of the radius */
const HOLE = 0.019;
/** Notes are punched no longer than this many steps, and a slot no longer than this many hole widths */
const LONGEST_STEPS = 3;
const LONGEST_SLOT = 3.5;

/** Where a song's notes sit on its disc */
export class DiscGeometry {
  readonly duration: number;
  readonly lead: number;
  private readonly low: number;
  private readonly high: number;
  private readonly longest: number;

  constructor(timeline: NoteTimeline | null) {
    // One turn is one pass: the intro, then the body once
    this.duration = timeline ? timeline.introDuration + timeline.loopDuration || 1 : 1;
    [this.low, this.high] = timeline?.range ?? [60, 72];
    this.lead = timeline?.lead ?? -1;
    this.longest = (timeline?.stepSeconds ?? 0.1) * LONGEST_STEPS;
  }

  /** Fraction of the radius for a pitch (-1: an unpitched hit) */
  radius(pitch: number): number {
    if (pitch < 0) return DISC.hits;
    const place = this.high > this.low ? (pitch - this.low) / (this.high - this.low) : 0.5;
    return DISC.inner + (Math.round(place * (ROWS - 1)) / (ROWS - 1)) * (DISC.outer - DISC.inner);
  }

  /** Canvas angle of a moment in the song, on the disc at rest */
  angle(seconds: number): number {
    return -Math.PI / 2 - ((seconds % this.duration) / this.duration) * TURN;
  }

  /** How far the disc has turned (clockwise, radians) at a moment in the song */
  turn(seconds: number): number {
    return (Math.min(seconds, this.duration) / this.duration) * TURN;
  }

  /** Add a perforation to the current path, about the disc's centre: a round hole, or a slot along its row for a long note */
  hole(g: CanvasRenderingContext2D, n: TimedNote, r: number, offset = 0, scale = 1): void {
    const radius = this.radius(n.pitch) * r;
    const width = HOLE * r * scale;
    const start = this.angle(n.start + offset);
    const cap = width / 2 / radius;
    const length = (Math.min(n.end - n.start, this.longest) / this.duration) * TURN;
    const sweep = Math.min(length, (LONGEST_SLOT * width) / radius) - 2 * cap;
    if (sweep <= 0) {
      // A round hole: a dot of the line's width
      const x = Math.cos(start) * radius;
      const y = Math.sin(start) * radius;
      g.moveTo(x, y);
      g.lineTo(x + 0.01, y);
    } else {
      g.moveTo(Math.cos(start - cap) * radius, Math.sin(start - cap) * radius);
      g.arc(0, 0, radius, start - cap, start - cap - sweep, true);
    }
  }

  /** Line width for perforations drawn with `hole` */
  holeWidth(r: number, scale = 1): number {
    return Math.max(1, HOLE * r * scale);
  }
}

/** Draw a song's disc `size` pixels across (face, rings, perforations and spindle), to be turned by whoever shows it */
export function renderDisc(timeline: NoteTimeline | null, theme: Theme, size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.max(8, Math.round(size));
  const g = canvas.getContext('2d');
  if (!g) return canvas;
  const r = canvas.width / 2;
  const line = Math.max(1, r / 140);
  g.translate(r, r);
  g.fillStyle = theme.raised;
  g.beginPath();
  g.arc(0, 0, r, 0, TURN);
  g.fill();
  ring(g, r * DISC.rim, line, alpha(theme.paper, 0.3));
  ring(g, r * DISC.hub, line, alpha(theme.paper, 0.16));

  if (timeline) {
    const geometry = new DiscGeometry(timeline);
    // Grouped by colour into a few strokes: loudness steps for the accompaniment, brass for the tune
    const groups = new Map<string, TimedNote[]>();
    for (const n of timeline.onePass()) {
      const level = Math.round(n.velocity * 4) / 4;
      const colour = n.track === geometry.lead ? mix(theme.raised, theme.accent, 0.6 + 0.4 * level) : mix(theme.raised, theme.paper, 0.25 + 0.5 * level);
      const list = groups.get(colour);
      if (list) list.push(n);
      else groups.set(colour, [n]);
    }
    // Overlapping holes keep the lighter colour, so a run of notes on one row reads as one slot
    g.globalCompositeOperation = 'lighten';
    g.lineCap = 'round';
    g.lineWidth = geometry.holeWidth(r);
    for (const [colour, notes] of groups) {
      g.strokeStyle = colour;
      g.beginPath();
      for (const n of notes) geometry.hole(g, n, r);
      g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
  }

  g.fillStyle = theme.ink;
  g.beginPath();
  g.arc(0, 0, r * DISC.spindle, 0, TURN);
  g.fill();
  ring(g, r * DISC.spindle, line, alpha(theme.paper, 0.35));
  return canvas;
}

function ring(g: CanvasRenderingContext2D, radius: number, width: number, colour: string): void {
  g.strokeStyle = colour;
  g.lineWidth = width;
  g.beginPath();
  g.arc(0, 0, radius, 0, TURN);
  g.stroke();
}
