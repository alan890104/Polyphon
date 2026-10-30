// Colour themes. Brass is the house palette (ink, paper and one gilt accent); the others are bolder moods to switch to.

import type { Palette } from '../disc.ts';

export type ThemeId = 'brass' | 'moonlight' | 'ember' | 'aurora' | 'mono';

export interface Theme {
  id: ThemeId;
  name: string;
  /** The background */
  ink: string;
  /** A step above the background: the disc's face, the keyboard's black keys */
  raised: string;
  /** Lines, bars and text */
  paper: string;
  /** Secondary lines and labels */
  muted: string;
  /** The one accent: peaks, the comb, notes sounding */
  accent: string;
  /** The accent lit up: perforations as they pass the comb */
  lit: string;
  /** One colour per track, cycled */
  tracks: readonly string[];
  /** Three colours the aurora background flows between */
  aurora: readonly [string, string, string];
}

export const THEMES: readonly Theme[] = [
  {
    id: 'brass',
    name: 'Brass',
    ink: '#0f0e0c',
    raised: '#1a1814',
    paper: '#eee7da',
    muted: '#8a8174',
    accent: '#c8a15a',
    lit: '#ecca86',
    tracks: ['#eee7da', '#c8a15a', '#8fae9f', '#c98a6b', '#9aa6b8', '#b46a6a', '#dcc79a', '#a79d8f'],
    aurora: ['#6b4f22', '#5a2a24', '#3a3326'],
  },
  {
    id: 'moonlight',
    name: 'Moonlight',
    ink: '#0a0d13',
    raised: '#151a24',
    paper: '#dfe6f0',
    muted: '#7c879a',
    accent: '#a9c3ec',
    lit: '#d6e4fa',
    tracks: ['#dfe6f0', '#a9c3ec', '#7fa0d6', '#c3b6ea', '#8ccbdc', '#e8dbb4', '#9fb0c8', '#b7d4f0'],
    aurora: ['#1d3a6b', '#2b2d5e', '#173f4f'],
  },
  {
    id: 'ember',
    name: 'Ember',
    ink: '#110a08',
    raised: '#1f1410',
    paper: '#f5e4d4',
    muted: '#9c8070',
    accent: '#dd7046',
    lit: '#f6b48c',
    tracks: ['#f0c48e', '#dd7046', '#f5e4d4', '#c0503a', '#e99a6e', '#b8673f', '#f6d6a8', '#d68a70'],
    aurora: ['#7a2412', '#8a4a10', '#4a1420'],
  },
  {
    id: 'aurora',
    name: 'Aurora',
    ink: '#070c0f',
    raised: '#10191d',
    paper: '#e2eeea',
    muted: '#728b88',
    accent: '#7cc4b0',
    lit: '#b8e6d9',
    tracks: ['#7cc4b0', '#a49ad6', '#7fb2cc', '#c4a6d4', '#a8cc9e', '#d6cc98', '#e2eeea', '#90cccb'],
    aurora: ['#1d5e52', '#3a2f6c', '#1a405e'],
  },
  {
    id: 'mono',
    name: 'Mono',
    ink: '#0c0c0c',
    raised: '#181818',
    paper: '#efefef',
    muted: '#8a8a8a',
    accent: '#ffffff',
    lit: '#ffffff',
    tracks: ['#efefef', '#bdbdbd', '#d9d9d9', '#9a9a9a', '#e4e4e4', '#adadad'],
    aurora: ['#3a3a3a', '#262626', '#4a4a4a'],
  },
];

export function themeById(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** The theme's colours for the song's disc */
export function discPalette(theme: Theme): Palette {
  return { ink: theme.ink, disc: theme.raised, paper: theme.paper, brass: theme.accent, lit: theme.lit };
}

/** The colour of a track (by its index in the song) */
export function trackColor(theme: Theme, track: number): string {
  return theme.tracks[track % theme.tracks.length];
}

/** '#rrggbb' as [r, g, b], 0-1 (for shaders) */
export function rgbOf(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const alphaCache = new Map<string, string>();

/** '#rrggbb' at an opacity, as a CSS colour (cached: frames ask for the same few over and over) */
export function alpha(hex: string, opacity: number): string {
  const a = Math.round(Math.min(1, Math.max(0, opacity)) * 100) / 100;
  const key = hex + a;
  let css = alphaCache.get(key);
  if (!css) {
    const [r, g, b] = rgbOf(hex).map((c) => Math.round(c * 255));
    css = `rgba(${r}, ${g}, ${b}, ${a})`;
    alphaCache.set(key, css);
  }
  return css;
}

/** Mix two '#rrggbb' colours (t = 0 gives a, 1 gives b) */
export function mix(a: string, b: string, t: number): string {
  const ca = rgbOf(a);
  const cb = rgbOf(b);
  const c = ca.map((v, i) => Math.round((v + (cb[i] - v) * t) * 255));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
