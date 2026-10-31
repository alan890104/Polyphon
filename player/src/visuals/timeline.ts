// A song's notes on the clock: every note of the intro and the body in seconds, timed as the playback schedules them (swing, strums,
// transposition), so visuals can show notes before they sound and land them exactly when they do.

import { compileSection, stepsPerBar, tempoClock, type Song, type Track } from 'polyphon';

export interface TimedNote {
  /** Seconds from the start of its section */
  start: number;
  end: number;
  /** MIDI pitch, or -1 for an unpitched hit (drums) */
  pitch: number;
  velocity: number;
  /** The track group (an intro track and a body track with the same name are one group), for colours */
  track: number;
}

interface Section {
  /** Seconds */
  duration: number;
  steps: number;
  /** Seconds from the start of the section to a step, and back */
  time: (step: number) => number;
  step: (seconds: number) => number;
  /** Sorted by start */
  notes: TimedNote[];
  /** The longest note, so a window query knows how far back to look for notes still sounding */
  longest: number;
}

/** How heavy a hit is: the low drums (kicks, booms, gongs), the middle ones (snares, claps, wood) or the high ones (hats, cymbals) */
export type Drum = 'low' | 'mid' | 'high';

/** Drums and effects whose pitch only picks a sample, by weight: shown as hits, not as notes on a keyboard */
const DRUMS: Record<Drum, readonly string[]> = {
  low: ['kick', 'boom', 'kick909', 'bigKick', 'gong', 'thunder', 'thunderclap', 'impact'],
  mid: ['snare', 'snare909', 'field', 'rim', 'clap', 'clap909', 'snap', 'brush', 'woodblock', 'clave', 'anvil', 'chain', 'drip'],
  high: ['hat', 'ohat', 'hat909', 'ohat909', 'ride', 'crash', 'swell', 'shaker', 'tamb', 'triangle'],
};
const UNPITCHED = new Map(Object.entries(DRUMS).flatMap(([drum, names]) => names.map((name) => [name, drum as Drum])));
/** Ambience beds: a looped texture with no notes to show */
const AMBIENCE = new Set(['wind', 'sea', 'fire', 'crickets', 'rain', 'void', 'cave']);

export class NoteTimeline {
  readonly song: Song;
  /** Track group names, in the order their colours are given */
  readonly groups: readonly string[];
  /** Seconds the intro lasts */
  readonly introDuration: number;
  /** Seconds one pass of the body lasts */
  readonly loopDuration: number;
  /** How many times the body plays */
  readonly passes: number;
  /** Lowest and highest pitched note (MIDI), or [60, 72] when the song has none */
  readonly range: readonly [number, number];
  private readonly sections: readonly [Section, Section];

  /** `passes`: how many times the body plays (the player plays it once, then moves on) */
  constructor(song: Song, passes = 1) {
    this.song = song;
    const clock = tempoClock(song);
    /** A section's clock, when it starts `base` steps into the song */
    const sectionClock = (base: number) => ({
      time: (step: number) => clock.seconds(base + step) - clock.seconds(base),
      step: (seconds: number) => clock.step(clock.seconds(base) + seconds) - base,
    });
    const groups: string[] = [];
    const groupOf = (track: Track) => {
      const name = track.name ?? track.instrument;
      const index = groups.indexOf(name);
      return index >= 0 ? index : groups.push(name) - 1;
    };
    const intro = song.intro?.length ? compileTracks(song, song.intro, sectionClock(0), groupOf) : { duration: 0, steps: 0, notes: [], longest: 0, ...sectionClock(0) };
    const body = compileTracks(song, song.tracks, sectionClock(intro.steps), groupOf);
    this.sections = [intro, body];
    this.groups = groups;
    this.introDuration = intro.duration;
    this.loopDuration = body.duration;
    this.passes = Math.max(1, passes);
    let low = Infinity;
    let high = -Infinity;
    for (const section of this.sections) {
      for (const n of section.notes) {
        if (n.pitch < 0) continue;
        low = Math.min(low, n.pitch);
        high = Math.max(high, n.pitch);
      }
    }
    this.range = low <= high ? [low, high] : [60, 72];
  }

  /** Seconds from the start to the end (the intro, then every pass of the body) */
  get duration(): number {
    return this.introDuration + this.passes * this.loopDuration;
  }

  /**
   * Visit every note that sounds at some point in [from, to) (seconds into the song).
   * A note's start in the song is `note.start + offset`; notes are not copied, so this allocates nothing.
   */
  forEach(from: number, to: number, visit: (note: TimedNote, offset: number) => void): void {
    const [intro, body] = this.sections;
    if (from < this.introDuration + intro.longest) visitSection(intro, 0, from, to, visit);
    if (!body.duration || to <= this.introDuration) return;
    const first = Math.max(0, Math.floor((from - this.introDuration) / body.duration) - 1);
    const last = Math.min(this.passes - 1, Math.floor((to - this.introDuration) / body.duration));
    for (let pass = first; pass <= last; pass++) visitSection(body, this.introDuration + pass * body.duration, from, to, visit);
  }

  /** Visit the bar lines in [from, to] (seconds into the song): when each bar starts, and its number, counted from 1 at the start of the song */
  forEachBar(from: number, to: number, visit: (seconds: number, bar: number) => void): void {
    const bar = stepsPerBar(this.song.meter);
    const [intro, body] = this.sections;
    const visitBars = (section: Section, offset: number, first: number) => {
      if (to < offset || from >= offset + section.duration) return;
      const lo = Math.ceil(section.step(Math.max(0, from - offset)) / bar - 1e-6);
      const hi = Math.floor(section.step(Math.min(section.duration, to - offset)) / bar + 1e-6);
      for (let b = lo; b <= hi && b * bar < section.steps; b++) visit(offset + section.time(b * bar), first + b);
    };
    visitBars(intro, 0, 1);
    const introBars = intro.steps / bar;
    for (let pass = 0; pass < this.passes; pass++) visitBars(body, this.introDuration + pass * body.duration, 1 + introBars + (pass * body.steps) / bar);
  }
}

function visitSection(section: Section, offset: number, from: number, to: number, visit: (note: TimedNote, offset: number) => void): void {
  const { notes } = section;
  const lo = from - offset - section.longest;
  const hi = to - offset;
  // Binary search for the first note that could still sound at `from`
  let a = 0;
  let b = notes.length;
  while (a < b) {
    const mid = (a + b) >> 1;
    if (notes[mid].start < lo) a = mid + 1;
    else b = mid;
  }
  for (let i = a; i < notes.length; i++) {
    const n = notes[i];
    if (n.start >= hi) break;
    if (n.end + offset > from) visit(n, offset);
  }
}

/** One section's notes in seconds, the way the playback schedules them */
function compileTracks(song: Song, tracks: Track[], clock: Pick<Section, 'time' | 'step'>, groupOf: (track: Track) => number): Section {
  const compiled = compileSection(tracks, song.meter ?? 16);
  const groups = tracks.map(groupOf);
  const notes: TimedNote[] = [];
  let longest = 0;
  for (const n of compiled.notes) {
    const track = tracks[n.track];
    if (AMBIENCE.has(track.instrument)) continue;
    const at = clock.time(swungStep(song, n.time));
    const duration = clock.time(n.time + n.duration) - clock.time(n.time);
    longest = Math.max(longest, duration);
    const base = { velocity: n.velocity, track: groups[n.track] };
    if (!n.pitches.length || drumOf(track.instrument)) {
      notes.push({ ...base, start: at, end: at + duration, pitch: -1 });
      continue;
    }
    n.pitches.forEach((m, k) => {
      const start = at + (n.strum ? k * n.strum : 0);
      notes.push({ ...base, start, end: start + duration, pitch: m + (track.transpose ?? 0) });
    });
  }
  notes.sort((a, b) => a.start - b.start);
  return { duration: clock.time(compiled.duration), steps: compiled.duration, notes, longest, ...clock };
}

/** How heavy a hit an instrument plays, or null for one that plays notes */
export function drumOf(instrument: string): Drum | null {
  return UNPITCHED.get(instrument) ?? null;
}

/** A step with the song's swing applied to on-grid steps (as the playback does) */
export function swungStep(song: Song, step: number): number {
  const i = Math.floor(step + 1e-6);
  if (Math.abs(step - i) >= 1e-6) return step;
  if (song.swing && i % 4 === 2) return step + song.swing * 2;
  if (song.swing16 && i % 2 === 1) return step + song.swing16;
  return step;
}
