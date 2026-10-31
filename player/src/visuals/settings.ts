// The visualizer's settings, kept in localStorage. Every read and write is guarded: private windows and blocked storage simply
// fall back to the defaults, which are gentler when the system asks for reduced motion.

import { BACKGROUNDS, type BackgroundId } from './backgrounds/index.ts';
import { STYLES, type StyleId } from './styles/index.ts';
import { THEMES, type ThemeId } from './themes.ts';

export interface VisualSettings {
  style: StyleId;
  background: BackgroundId;
  theme: ThemeId;
  /** 0.5-2: how strongly the visuals answer the music */
  sensitivity: number;
  /** 0-1: how far things move, burst and pulse */
  motion: number;
  /** Show the song's title and position */
  showTitle: boolean;
  /** Hide the controls after a few seconds without the pointer moving */
  autoHide: boolean;
  /** Spectrum: bars grow both ways from a centre line */
  mirror: boolean;
  /** Waveform: phosphor echoes and a slower bass line */
  layered: boolean;
}

const KEY = 'polyphon.visuals';

export function defaultSettings(reducedMotion: boolean): VisualSettings {
  return {
    style: 'musicbox',
    background: 'ink',
    theme: 'brass',
    sensitivity: 1,
    motion: reducedMotion ? 0.25 : 0.7,
    showTitle: true,
    autoHide: true,
    mirror: false,
    layered: true,
  };
}

export function loadSettings(reducedMotion: boolean): VisualSettings {
  const defaults = defaultSettings(reducedMotion);
  let stored: unknown = null;
  try {
    stored = JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {
    return defaults;
  }
  if (!stored || typeof stored !== 'object') return defaults;
  const s = stored as Record<string, unknown>;
  return {
    style: pick(s.style, STYLES.map((x) => x.id), defaults.style),
    background: pick(s.background, BACKGROUNDS.map((x) => x.id), defaults.background),
    theme: pick(s.theme, THEMES.map((x) => x.id), defaults.theme),
    sensitivity: range(s.sensitivity, 0.5, 2, defaults.sensitivity),
    motion: range(s.motion, 0, 1, defaults.motion),
    showTitle: flag(s.showTitle, defaults.showTitle),
    autoHide: flag(s.autoHide, defaults.autoHide),
    mirror: flag(s.mirror, defaults.mirror),
    layered: flag(s.layered, defaults.layered),
  };
}

export function saveSettings(settings: VisualSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage is full or blocked: the settings last for this visit only
  }
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.find((a) => a === value) ?? fallback;
}

function range(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}
