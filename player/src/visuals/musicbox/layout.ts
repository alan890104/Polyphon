// Where everything sits on the music box, in metres, and how a song's perforations are laid out on its disc.
//
// The disc is a real polyphon disc (50 cm across). Pitched perforations are punched on concentric tracks, one per pitch the song
// uses, low pitches inside and high ones outside, so the comb has one tooth per note of the arrangement (a music box comb is tuned
// to its tunes). Drum hits have rings of their own inside the tracks, one for each weight of drum, each read by a brass hammer.
//
// Angles follow the player's disc (../../disc.ts): a perforation at `at` (a fraction of a turn) sits `at` of a turn round from the
// comb, and the disc turns clockwise seen from above, so it reaches the comb exactly when it sounds. Its leading edge is the
// moment it sounds; a long note's slot trails behind it.

import type { Disc, Perforation } from '../../disc.ts';
import type { Drum } from '../timeline.ts';

export const DISC_RADIUS = 0.25;
/** Steel sheet */
export const DISC_THICKNESS = 0.0012;
/** Radii as fractions of the disc's radius, as in the player's disc */
export const INNER_TRACK = 0.38;
export const OUTER_TRACK = 0.88;
/** The drum rings: the high drums next to the tracks, the low ones nearest the label */
const DRUM_RINGS: Record<Drum, number> = { high: 0.335, mid: 0.3, low: 0.265 };
/** The printed label round the spindle */
export const LABEL = 0.225;
/** The ring of drive holes the motor's sprocket turns the disc by */
export const DRIVE_RING = 0.952;
export const DRIVE_HOLES = 132;
/** Notes longer than this many perforation widths are punched no longer */
const LONGEST_SLOT = 2.6;
/** A blank disc (nothing playing) still sits under a comb of this many teeth */
const BLANK_TEETH = 16;

export interface Row {
  /** Metres from the centre */
  radius: number;
  /** 0 (lowest pitch) to 1 (highest); drums are 0 */
  pitch: number;
  /** The weight of drum its hammer strikes, or null for a tooth */
  drum: Drum | null;
}

export interface Slot {
  row: number;
  /** Angle round the disc of its leading edge, in disc coordinates (radians: 2π × at) */
  angle: number;
  /** Arc length along the track (metres) */
  length: number;
  /** When it reaches the comb, as a fraction of a turn */
  at: number;
  /** How long its note sounds, as a fraction of a turn */
  hold: number;
  velocity: number;
  lead: boolean;
}

export interface DiscLayout {
  rows: Row[];
  /** In order round the disc */
  slots: Slot[];
  /** Width of a perforation across its track (metres) */
  holeWidth: number;
  /** Distance between neighbouring tracks (metres) */
  spacing: number;
}

/** Lay a disc's perforations out on tracks: one per distinct pitch, then a ring for each weight of drum it uses */
export function layoutDisc(disc: Disc): DiscLayout {
  const found = [...new Set(disc.holes.flatMap((h) => (h.pitch === null ? [] : [h.pitch])))].sort((a, b) => a - b);
  const pitches = found.length ? found : Array.from({ length: BLANK_TEETH }, (_, i) => i / (BLANK_TEETH - 1));
  const tracks = pitches.length;
  const band = (OUTER_TRACK - INNER_TRACK) * DISC_RADIUS;
  const spacing = tracks > 1 ? band / (tracks - 1) : band;
  const holeWidth = clamp(spacing * 0.62, 0.0011, 0.0026);
  const rows: Row[] = pitches.map((pitch, i) => ({
    radius: DISC_RADIUS * (tracks > 1 ? INNER_TRACK + (i / (tracks - 1)) * (OUTER_TRACK - INNER_TRACK) : (INNER_TRACK + OUTER_TRACK) / 2),
    pitch,
    drum: null,
  }));
  const rowOfPitch = new Map(pitches.map((p, i) => [p, i]));
  const rowOfDrum = new Map<Drum, number>();
  for (const drum of ['high', 'mid', 'low'] as const) {
    if (!disc.holes.some((h) => h.drum === drum)) continue;
    rowOfDrum.set(drum, rows.push({ radius: DRUM_RINGS[drum] * DISC_RADIUS, pitch: 0, drum }) - 1);
  }
  const slots = disc.holes.map((hole) => {
    const row = hole.drum ? rowOfDrum.get(hole.drum)! : rowOfPitch.get(hole.pitch!)!;
    return slot(hole, row, rows[row].radius, holeWidth);
  });
  slots.sort((a, b) => a.at - b.at);
  return { rows, slots, holeWidth, spacing };
}

function slot(hole: Perforation, row: number, radius: number, width: number): Slot {
  const arc = hole.length * Math.PI * 2 * radius;
  return {
    row,
    angle: hole.at * Math.PI * 2,
    length: clamp(arc, width, width * LONGEST_SLOT),
    at: hole.at,
    hold: hole.length,
    velocity: hole.velocity,
    lead: hole.lead,
  };
}

/** A point on the disc in its own coordinates (x, z), at `angle` round from the comb and `radius` out */
export function discPoint(angle: number, radius: number): [number, number] {
  return [radius * Math.sin(angle), radius * Math.cos(angle)];
}

export function clamp(x: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, x));
}
