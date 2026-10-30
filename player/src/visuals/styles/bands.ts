// Resample the analysis bands to however many bars a style draws, and place frequencies along them.

import { BAND_COUNT, HIGH_HZ, LOW_HZ } from '../analysis.ts';

/** Fill `out` with the bands between two fractions of the spectrum (0 = 32 Hz, 1 = 16 kHz), read between neighbours */
export function sampleBands(bands: Float32Array, out: Float32Array, from: number, to: number): void {
  const n = out.length;
  for (let k = 0; k < n; k++) {
    const x = (from + ((k + 0.5) / n) * (to - from)) * (BAND_COUNT - 1);
    const i = Math.floor(x);
    const t = x - i;
    out[k] = bands[i] + ((bands[Math.min(BAND_COUNT - 1, i + 1)] ?? 0) - bands[i]) * t;
  }
}

/** Where a frequency falls between two fractions of the spectrum, 0-1 (outside that range: below 0 or above 1) */
export function frequencyPlace(hz: number, from: number, to: number): number {
  const x = Math.log(hz / LOW_HZ) / Math.log(HIGH_HZ / LOW_HZ);
  return (x - from) / (to - from);
}

/** Soften a row of values with its neighbours (a [1 2 1] blur), so adjacent bars read as one shape */
export function soften(values: Float32Array): void {
  let previous = values[0];
  for (let k = 0; k < values.length; k++) {
    const current = values[k];
    const next = values[Math.min(values.length - 1, k + 1)];
    values[k] = (previous + current * 2 + next) / 4;
    previous = current;
  }
}
