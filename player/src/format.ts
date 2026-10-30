// Text for times, lengths, meters and errors.

import type { Meter } from 'polyphon';

/** Seconds as a clock: 83 → "1:23" */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** A total length in words: "4 min 12 sec", "1 hr 5 min" */
export function formatLength(seconds: number): string {
  const s = Math.round(seconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  if (hours) return `${hours} hr ${minutes} min`;
  return minutes ? `${minutes} min ${s % 60} sec` : `${s} sec`;
}

/** A time signature. A meter given in sixteenth-note steps per bar is shown in quarters or eighths when it can be: 16 → "4/4", 14 → "7/8" */
export function formatMeter(meter: Meter = '4/4'): string {
  if (typeof meter !== 'number') return meter;
  if (meter % 4 === 0) return `${meter / 4}/4`;
  return meter % 2 === 0 ? `${meter / 2}/8` : `${meter}/16`;
}

/** Roughly how many Latin letters wide a text is set (CJK characters are about twice as wide) */
export function textWidth(text: string): number {
  return [...text].reduce((width, char) => width + (/[\u2e80-\u9fff\uac00-\ud7af\uff00-\uffef]/.test(char) ? 1.8 : 1), 0);
}

/** 7 → "07": track and channel numbers */
export function twoDigits(n: number): string {
  return String(n).padStart(2, '0');
}

/** "1 song", "12 songs" */
export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
