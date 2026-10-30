// Generated cover art: an id always gives the same two colors and the same motif, so every song and playlist has a recognisable cover
// without any image files.

import type { LibraryPlaylist } from './library.ts';

export const MOTIFS = ['sun', 'rings', 'stripes', 'peaks', 'orbit', 'dots', 'waves'] as const;
export type Motif = (typeof MOTIFS)[number];

export interface Art {
  /** The main hue, 0-360 (it also tints the page around a large cover) */
  hue: number;
  /** CSS background: a two-color gradient */
  background: string;
  motif: Motif;
  /** Rotation of the motif, in degrees (quarter turns) */
  turn: number;
  /** 0-1: moves the parts of the motif around */
  shift: number;
}

export function artFor(id: string): Art {
  const random = generator(hash(id));
  const hue = Math.floor(random() * 360);
  const second = hue + (random() < 0.5 ? -1 : 1) * (40 + random() * 70);
  const angle = Math.floor(random() * 360);
  return {
    hue,
    background: `linear-gradient(${angle}deg, oklch(0.74 0.13 ${hue}), oklch(0.38 0.12 ${second}))`,
    motif: MOTIFS[Math.floor(random() * MOTIFS.length)],
    turn: Math.floor(random() * 4) * 90,
    shift: random(),
  };
}

/** The ids a playlist cover is made of: its first four songs as a mosaic, or only the first song when it has fewer (as Spotify does) */
export function coverIds(playlist: LibraryPlaylist): string[] {
  const ids = playlist.songs.map((s) => s.id);
  return ids.length >= 4 ? ids.slice(0, 4) : [ids[0] ?? playlist.id];
}

/** FNV-1a: a 32-bit hash of a string */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** Mulberry32: a small seeded random generator (0-1) */
function generator(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
