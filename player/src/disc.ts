// Discs: a song's notes punched as perforations in a turning disc, the way a polyphon music box stores its tune.
// Angle is time across one pass (intro, then the body once), radius is pitch within the song's own range, opacity is velocity,
// and the tune itself (the lead track) is punched in brass. Covers are drawn once and kept as image URLs; the Now playing disc and
// the immersive view turn theirs under the comb and light each perforation as it passes.

import { compileSection, tempoClock, type ScheduledNote, type Song, type Track } from 'polyphon';
import { playable, trackName, type LibraryPlaylist, type ReadySong } from './library.ts';
import { drumOf, swungStep, type Drum } from './visuals/timeline.ts';

export interface Perforation {
  /** Start, as a fraction of one turn: when it sounds, swing and strums included, so it passes the comb as it plays */
  at: number;
  /** Length, as a fraction of one turn (a hole shorter than it is wide is round) */
  length: number;
  /** Across the band of tracks, 0 (lowest pitch, inner edge) to 1 (highest, outer edge); null for unpitched drums, which have a ring of their own */
  pitch: number | null;
  /** How heavy a drum an unpitched hit is (null for a pitched note) */
  drum: Drum | null;
  /** 0-1 */
  velocity: number;
  /** Part of the tune */
  lead: boolean;
}

export interface Disc {
  /** In the score's order, which a thinned disc samples them in (so swing and strums never change which holes it keeps) */
  holes: Perforation[];
  /** Where each song starts, as fractions of a turn (a playlist's disc holds several songs) */
  marks: number[];
}

/**
 * How a disc is drawn at each size: a small one shows the music's texture, a large one its detail, a full one (the immersive
 * view's) every note. Pitches are punched on `tracks` concentric rows, like the tracks a polyphon's comb reads; `hole` is the
 * width of a perforation; `pixels` is the size of its image.
 */
const DISC_SIZES = {
  small: { pixels: 96, most: 120, tracks: 6, hole: 0.06 },
  large: { pixels: 560, most: 700, tracks: 18, hole: 0.019 },
  full: { pixels: 1024, most: Infinity, tracks: 18, hole: 0.019 },
} as const;
export type DiscSize = keyof typeof DISC_SIZES;

/** Where things sit on a disc drawn into a square canvas, in pixels */
export interface Geometry {
  center: number;
  radius: number;
  /** Rows of pitches */
  tracks: number;
  /** Width of a perforation */
  hole: number;
  /** Width of a hairline */
  line: number;
}

/** The colors a disc is drawn in: the stylesheet's brass on ink for the covers, the theme's in the immersive view */
export interface Palette {
  /** The spindle hole */
  ink: string;
  /** The disc's face */
  disc: string;
  /** Rings, and the accompaniment's perforations */
  paper: string;
  /** The tune's perforations, and the comb */
  brass: string;
  /** Perforations as they pass the comb */
  lit: string;
}

export const EMPTY_DISC: Disc = { holes: [], marks: [] };

const TURN = Math.PI * 2;
/** Radii, as fractions of the disc's radius */
const RIM = 0.97;
const OUTER_TRACK = 0.88;
const INNER_TRACK = 0.38;
const DRUM_TRACK = 0.3;
const HUB = 0.22;
const SPINDLE = 0.045;
/** Notes longer than this (sixteenth-note steps) are punched no longer */
const LONGEST = 3;
/** The longest slot, in hole widths: in a short song a note spans a wide angle, but it stays a perforation */
const LONGEST_SLOT = 3.5;
/** A tune lies above this MIDI pitch on average (E3), which keeps bass lines out */
const TUNE_ABOVE = 52;

const songDiscs = new WeakMap<Song, Disc>();
const playlistDiscs = new WeakMap<LibraryPlaylist, Disc>();
const thinned = new WeakMap<Disc, Map<DiscSize, readonly Perforation[]>>();
const images = new WeakMap<Disc, Map<DiscSize, string>>();

export function songDisc(song: Song): Disc {
  let disc = songDiscs.get(song);
  if (!disc) songDiscs.set(song, (disc = { holes: punchOrNothing(song), marks: [] }));
  return disc;
}

/** A playlist's songs end to end around one disc, each taking a share of the turn as long as the song */
export function playlistDisc(playlist: LibraryPlaylist): Disc {
  let disc = playlistDiscs.get(playlist);
  if (!disc) playlistDiscs.set(playlist, (disc = join(playable(playlist))));
  return disc;
}

/** The perforations drawn at a size, in order around the disc: all of them, or an even sample of at most `most` that keeps the tune */
export function holesAt(disc: Disc, size: DiscSize): readonly Perforation[] {
  let sizes = thinned.get(disc);
  if (!sizes) thinned.set(disc, (sizes = new Map()));
  let holes = sizes.get(size);
  if (!holes) sizes.set(size, (holes = [...thin(disc.holes, DISC_SIZES[size].most)].sort((a, b) => a.at - b.at)));
  return holes;
}

/** A disc drawn once, as an image URL */
export function discImage(disc: Disc, size: DiscSize): string {
  let urls = images.get(disc);
  if (!urls) images.set(disc, (urls = new Map()));
  let url = urls.get(size);
  if (!url) urls.set(size, (url = discCanvas(disc, size, DISC_SIZES[size].pixels, palette()).toDataURL()));
  return url;
}

/** A disc drawn on a new square canvas of `pixels`, leaving `inset` (a fraction of the radius) free around it */
export function discCanvas(disc: Disc, size: DiscSize, pixels: number, colors: Palette, inset = 0): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.max(8, Math.round(pixels));
  const geo = geometry(canvas.width, size, inset);
  const g = context2d(canvas);
  const { center: c, radius: r, line } = geo;

  g.fillStyle = colors.disc;
  g.beginPath();
  g.arc(c, c, r, 0, TURN);
  g.fill();
  ring(g, geo, RIM, colors.paper, 0.3);
  ring(g, geo, HUB, colors.paper, 0.16);
  // A tick on the rim where each song starts
  g.globalAlpha = 0.4;
  g.strokeStyle = colors.paper;
  g.lineWidth = line;
  for (const mark of disc.marks) {
    const a = angleOf(mark);
    g.beginPath();
    g.moveTo(c + Math.cos(a) * r * RIM, c + Math.sin(a) * r * RIM);
    g.lineTo(c + Math.cos(a) * r * (OUTER_TRACK + 0.045), c + Math.sin(a) * r * (OUTER_TRACK + 0.045));
    g.stroke();
  }
  // Solid colors, kept where holes overlap ('lighten'), so a run of notes on one track reads as one slot, not a brighter one
  g.globalCompositeOperation = 'lighten';
  for (const hole of holesAt(disc, size)) {
    const color = hole.lead ? mix(colors.disc, colors.brass, 0.6 + 0.4 * hole.velocity) : mix(colors.disc, colors.paper, 0.25 + 0.5 * hole.velocity);
    drawHole(g, hole, geo, color, 1);
  }
  g.globalCompositeOperation = 'source-over';
  // The spindle hole
  g.globalAlpha = 1;
  g.fillStyle = colors.ink;
  g.beginPath();
  g.arc(c, c, r * SPINDLE, 0, TURN);
  g.fill();
  ring(g, geo, SPINDLE, colors.paper, 0.35);
  return canvas;
}

/** One perforation: a round hole, or an oblong one along its track for a long note */
export function drawHole(g: CanvasRenderingContext2D, hole: Perforation, geo: Geometry, color: string, alpha: number, scale = 1): void {
  const track = hole.pitch === null ? null : Math.round(hole.pitch * (geo.tracks - 1)) / (geo.tracks - 1);
  const r = geo.radius * (track === null ? DRUM_TRACK : INNER_TRACK + track * (OUTER_TRACK - INNER_TRACK));
  const width = geo.hole * scale;
  const start = angleOf(hole.at);
  // The round ends take half a width each
  const cap = width / 2 / r;
  const sweep = Math.min(hole.length * TURN, (LONGEST_SLOT * width) / r) - 2 * cap;
  g.globalAlpha = alpha;
  g.beginPath();
  if (sweep <= 0) {
    g.fillStyle = color;
    g.arc(geo.center + Math.cos(start) * r, geo.center + Math.sin(start) * r, width / 2, 0, TURN);
    g.fill();
  } else {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.lineCap = 'round';
    g.arc(geo.center, geo.center, r, start - cap - sweep, start - cap);
    g.stroke();
  }
}

/** Each perforation that passed the comb less than `afterglow` (a fraction of a turn) before `turn`, with its glow: 1 as it passes, fading to 0 */
export function forEachLit(holes: readonly Perforation[], turn: number, afterglow: number, visit: (hole: Perforation, glow: number) => void): void {
  for (let i = firstFrom(holes, turn - afterglow); i < holes.length && holes[i].at <= turn; i++) {
    const glow = 1 - (turn - holes[i].at) / afterglow;
    // Rounding can leave the first one a hair past the afterglow
    if (glow > 0) visit(holes[i], glow);
  }
}

/** The comb at 12 o'clock: a hairline across the tracks, and a small pointer outside the rim (as opaque as the hairline unless `pointer` says) */
export function drawComb(g: CanvasRenderingContext2D, geo: Geometry, color: string, alpha: number, pointer = alpha): void {
  const { center: c, radius: r, line } = geo;
  g.globalAlpha = alpha;
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = line * 1.5;
  g.lineCap = 'butt';
  g.beginPath();
  g.moveTo(c, c - r * RIM);
  g.lineTo(c, c - r * (DRUM_TRACK - 0.04));
  g.stroke();
  const tip = c - r - line * 3;
  const half = r * 0.035;
  g.globalAlpha = pointer;
  g.beginPath();
  g.moveTo(c - half, tip - half * 1.6);
  g.lineTo(c + half, tip - half * 1.6);
  g.lineTo(c, tip);
  g.closePath();
  g.fill();
}

/** How far a disc has turned, 0-1, `position` seconds into a pass of `duration` seconds */
export function turnAt(position: number, duration: number): number {
  return duration > 0 ? Math.min(1, position / duration) : 0;
}

/** Where things sit on a disc drawn into a square of `pixels`, leaving `inset` (a fraction of the radius) free around it */
export function geometry(pixels: number, size: DiscSize, inset = 0): Geometry {
  const radius = (pixels / 2) * (1 - inset);
  const { tracks, hole } = DISC_SIZES[size];
  return { center: pixels / 2, radius, tracks, hole: radius * hole, line: Math.max(1, radius / 140) };
}

/** The colors, from the stylesheet's custom properties */
export function palette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const read = (name: string) => css.getPropertyValue(name).trim();
  return { ink: read('--ink'), disc: read('--disc'), paper: read('--paper'), brass: read('--brass'), lit: read('--brass-lit') };
}

export function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = canvas.getContext('2d');
  if (!g) throw new Error('This browser cannot draw on a canvas');
  return g;
}

/** Time runs counter-clockwise from 12 o'clock, so a disc turning clockwise plays its perforations in order under the comb */
function angleOf(at: number): number {
  return -Math.PI / 2 - at * TURN;
}

/** A color `amount` (0-1) of the way from one #rrggbb color to another */
function mix(from: string, to: string, amount: number): string {
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [a, b] = [rgb(from), rgb(to)];
  return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * amount)).join(' ')})`;
}

function ring(g: CanvasRenderingContext2D, geo: Geometry, radius: number, color: string, alpha: number): void {
  g.globalAlpha = alpha;
  g.strokeStyle = color;
  g.lineWidth = geo.line;
  g.beginPath();
  g.arc(geo.center, geo.center, geo.radius * radius, 0, TURN);
  g.stroke();
}

/** A song that cannot be compiled (an unknown instrument) gets a blank disc; playing it reports the error */
function punchOrNothing(song: Song): Perforation[] {
  try {
    return punch(song);
  } catch {
    return [];
  }
}

/** Every note of one pass of the song, as perforations (a chord punches one hole per pitch), timed as the playback plays them */
function punch(song: Song): Perforation[] {
  const meter = song.meter ?? 16;
  const sections = [song.intro ?? [], song.tracks].filter((tracks) => tracks.length).map((tracks) => ({ tracks, ...compileSection(tracks, meter) }));
  const body = sections.at(-1);
  if (!body) return [];
  // The disc turns at an even speed, so a hole sits where its note falls in time (a slower passage is spread wider)
  const clock = tempoClock(song);
  const turn = clock.seconds(sections.reduce((steps, s) => steps + s.duration, 0));
  const tune = tuneTrack(body.tracks, body.notes);
  const holes: (Omit<Perforation, 'pitch'> & { midi: number | null })[] = [];
  let offset = 0;
  for (const { tracks, notes, duration } of sections) {
    for (const note of notes) {
      const track = tracks[note.track];
      // A silent track only drives another's ducking: nothing is heard, so nothing is punched
      if (track.gain === 0) continue;
      const start = offset + note.time;
      const at = clock.seconds(offset + swungStep(song, note.time));
      const strum = note.strum ?? 0;
      const length = clock.seconds(start + Math.min(note.duration, LONGEST)) - clock.seconds(start);
      const hole = { length: length / turn, velocity: note.velocity, lead: trackName(track) === tune };
      // A drum's pitch only picks its sample: it is a hit on the drum ring, not a note on the tracks
      const drum = drumOf(track.instrument);
      if (drum || !note.pitches.length) holes.push({ ...hole, at: at / turn, midi: null, drum: drum ?? 'mid' });
      else note.pitches.forEach((midi, k) => holes.push({ ...hole, at: (at + k * strum) / turn, midi: midi + (track.transpose ?? 0), drum: null }));
    }
    offset += duration;
  }
  let low = Infinity;
  let high = -Infinity;
  for (const { midi } of holes) {
    if (midi === null) continue;
    low = Math.min(low, midi);
    high = Math.max(high, midi);
  }
  return holes.map(({ midi, ...hole }) => ({ ...hole, pitch: midi === null ? null : high > low ? (midi - low) / (high - low) : 0.5 }));
}

/** The track that carries the tune: of the tracks that play one note at a time above the bass, the one with the most varied pitches and rhythms */
function tuneTrack(tracks: Track[], notes: ScheduledNote[]): string | null {
  const stats = tracks.map(() => ({ notes: 0, chords: 0, pitchSum: 0, pitches: new Set<number>(), lengths: new Set<number>() }));
  for (const note of notes) {
    if (!note.pitches.length || drumOf(tracks[note.track].instrument)) continue;
    const s = stats[note.track];
    s.notes++;
    if (note.pitches.length > 1) s.chords++;
    s.pitchSum += note.pitches[0];
    for (const p of note.pitches) s.pitches.add(p);
    s.lengths.add(note.duration);
  }
  let best: Track | null = null;
  let bestScore = 0;
  for (const [i, s] of stats.entries()) {
    if (s.notes < 4 || s.chords > s.notes / 10 || s.pitchSum / s.notes < TUNE_ABOVE) continue;
    const score = s.pitches.size * s.lengths.size;
    if (score <= bestScore) continue;
    best = tracks[i];
    bestScore = score;
  }
  return best && trackName(best);
}

/** Songs end to end, each with its share of the perforations */
function join(songs: ReadySong[]): Disc {
  const total = songs.reduce((seconds, s) => seconds + s.duration, 0);
  const share = Math.ceil(DISC_SIZES.large.most / Math.max(1, songs.length));
  const holes: Perforation[] = [];
  const marks: number[] = [];
  let start = 0;
  for (const { song, duration } of songs) {
    const from = start / total;
    const span = duration / total;
    marks.push(from);
    for (const hole of thin(songDisc(song).holes, share)) holes.push({ ...hole, at: from + hole.at * span, length: hole.length * span });
    start += duration;
  }
  return { holes, marks: songs.length > 1 ? marks : [] };
}

/** At most `most` perforations, sampled evenly and kept in their order; up to half of them are kept for the tune, so it stays legible */
function thin(holes: readonly Perforation[], most: number): readonly Perforation[] {
  if (holes.length <= most) return holes;
  const tune = holes.filter((h) => h.lead);
  const kept = new Set(sample(tune, Math.min(tune.length, Math.floor(most / 2))));
  for (const hole of sample(holes.filter((h) => !h.lead), most - kept.size)) kept.add(hole);
  return holes.filter((h) => kept.has(h));
}

/** The index of the first perforation at or after `at` (they are in order around the disc) */
function firstFrom(holes: readonly Perforation[], at: number): number {
  let low = 0;
  let high = holes.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (holes[mid].at < at) low = mid + 1;
    else high = mid;
  }
  return low;
}

function sample<T>(items: readonly T[], count: number): T[] {
  if (items.length <= count) return [...items];
  const step = items.length / count;
  return Array.from({ length: count }, (_, i) => items[Math.floor(i * step)]);
}
