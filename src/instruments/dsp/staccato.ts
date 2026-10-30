// Short sampled notes for fast figures (much cheaper than live synthesis): spiccato strings and brass stabs.

import { Biquad, rng, tailFade } from './core.ts';

/**
 * Spiccato strings: the bow drops onto the string, draws a few periods of sawtooth (Helmholtz) motion, bounces off, and the string rings on freely.
 * - Bowed for the first 40-65 ms: harmonics falling as 1/k through the body, the bite of the bow lightening as it bounces, and the rustle
 *   of the hair catching the string.
 * - Then free: each partial decays at its own rate. The string's internal losses and the bridge take more energy per second from the
 *   upper partials (the decay rate grows with frequency), so they are gone within ~0.1 s while the fundamental rings on and the note
 *   darkens as it dies, like a pizzicato. (One envelope on every partial kept the attack's bright tone to the end, like a gated synth.)
 * - Five players a few cents and a few milliseconds apart: three copies at ±7 cents beat like a chorus.
 */
export function spicc(sr: number, m: number): Float32Array {
  const f = 440 * Math.pow(2, (m - 69) / 12);
  const y = new Float32Array(Math.floor(sr * 0.42));
  const nyq = sr * 0.42;
  const body = (hz: number) => 0.4 + 1.2 / (1 + ((hz - 450) / 250) ** 2) + 0.7 / (1 + ((hz - 1300) / 500) ** 2) + 0.5 / (1 + ((hz - 3000) / 900) ** 2);
  const r = rng(m * 5 + 1);
  // The bow bites and lightens as it bounces (shared by every partial)
  const acc = new Float32Array(y.length);
  for (let i = 0; i < y.length; i++) acc[i] = Math.min(1, i / sr / 0.008) * (0.25 + 0.75 * Math.exp(-i / sr / 0.06));
  for (let p = 0; p < 5; p++) {
    const ff = f * Math.pow(2, (5 * r()) / 1200);
    const i0 = Math.floor(((r() + 1) / 2) * 0.012 * sr);
    // The bow leaves the string
    const i1 = i0 + Math.floor((0.052 + 0.012 * r()) * sr);
    for (let k = 1; k < 40; k++) {
      const hz = ff * k;
      if (hz > nyq) break;
      // Decay rate of the free string (nepers per second): T60 ≈ 0.5 s for the fundamental of A3, 0.09 s at 3 kHz
      const dk = Math.exp(-(6 + 0.025 * hz) / sr);
      let e = (0.77 * body(hz)) / k / (1 + (hz / 4500) ** 2);
      // A rotating phasor from a random phase (cheaper than Math.sin per sample)
      const w = (2 * Math.PI * hz) / sr;
      const c = Math.cos(w);
      const s = Math.sin(w);
      const ph = r() * Math.PI;
      let x = Math.cos(ph);
      let z = Math.sin(ph);
      for (let i = i0; i < y.length; i++) {
        y[i] += z * e * acc[i - i0];
        const nx = x * c - z * s;
        z = x * s + z * c;
        x = nx;
        if (i >= i1) e *= dk;
      }
    }
  }
  const noise = new Biquad(sr, 'bp', Math.min(7000, f * 5), 1.2);
  for (let i = 0; i < y.length; i++) y[i] += noise.run(r()) * 0.6 * Math.exp(-i / sr / 0.03);
  // Levelled on the first 150 ms (the old peak normalization left notes ±3 dB apart at random; this is their average)
  let e = 0;
  const w = Math.floor(sr * 0.15);
  for (let i = 0; i < w; i++) e += y[i] * y[i];
  const g = 0.24 / (Math.sqrt(e / w) || 1);
  for (let i = 0; i < y.length; i++) y[i] *= g;
  return tailFade(y, sr);
}

/**
 * Brass stab: a short forte blat from two players, a few cents and 12 ms apart. As in the live brass (voices.ts), the lips are a valve whose
 * harmonics fall as e^(-f/F), with F following the loudness: the harmonics come in one after another during the attack, the note is brassiest
 * at its peak and darkens as it dies away. The bell radiates the lows poorly and the cup rolls off the top (first-order corners at 1.1 and 6 kHz).
 * Levelled on its first 250 ms, so every pitch hits equally hard.
 */
export function brassStab(sr: number, m: number): Float32Array {
  const f = 440 * Math.pow(2, (m - 69) / 12);
  const y = new Float32Array(Math.floor(sr * 0.55));
  const nyq = sr * 0.42;
  const r = rng(m * 3 + 9);
  const lo = 1100;
  const hi = 6000;
  const env = (t: number) => Math.min(1, t / 0.02) * Math.exp(-t / 0.28);
  const BLOCK = 32;
  for (const [det, delay] of [[-6, 0], [6, 0.012]]) {
    const ff = f * Math.pow(2, det / 1200);
    const n = Math.min(80, Math.floor(nyq / ff));
    // Each harmonic is a rotating phasor (cheap sines) from a random phase, with the bell's response and the rotation over one block
    const bell = new Float64Array(n + 1);
    const re = new Float64Array(n + 1);
    const im = new Float64Array(n + 1);
    const cw = new Float64Array(n + 1);
    const sw = new Float64Array(n + 1);
    const cb = new Float64Array(n + 1);
    const sb = new Float64Array(n + 1);
    for (let k = 1; k <= n; k++) {
      const hz = ff * k;
      bell[k] = ((lo + hi) * hz) / Math.sqrt((hz * hz + lo * lo) * (hz * hz + hi * hi));
      const ph = r() * Math.PI;
      const w = (2 * Math.PI * hz) / sr;
      re[k] = Math.cos(ph);
      im[k] = Math.sin(ph);
      cw[k] = Math.cos(w);
      sw[k] = Math.sin(w);
      cb[k] = Math.cos(w * BLOCK);
      sb[k] = Math.sin(w * BLOCK);
    }
    const amp = new Float64Array(n + 1);
    const i0 = Math.floor(delay * sr);
    // (The last part-block falls inside the tail fade and is left silent)
    for (let b = i0; b + BLOCK <= y.length; b += BLOCK) {
      // Per block: the fall-off F from the loudness, then the harmonics' amplitudes, scaled so the loudness follows the envelope
      const e = env((b - i0) / sr);
      const rr = Math.exp(-ff / (2400 * (0.25 + 0.75 * Math.pow(e, 0.7))));
      let rn = 1;
      let s = 0;
      for (let k = 1; k <= n; k++) {
        rn *= rr;
        amp[k] = rn * bell[k];
        s += amp[k] * amp[k];
      }
      const g = e / (Math.sqrt(s) || 1);
      for (let k = 1; k <= n; k++) {
        const a = amp[k] * g;
        let x = re[k];
        let z = im[k];
        if (a < 1e-6) {
          // Too weak to hear: just turn the phasor on by a block
          re[k] = x * cb[k] - z * sb[k];
          im[k] = x * sb[k] + z * cb[k];
          continue;
        }
        for (let i = b; i < b + BLOCK; i++) {
          y[i] += z * a;
          const nx = x * cw[k] - z * sw[k];
          z = x * sw[k] + z * cw[k];
          x = nx;
        }
        re[k] = x;
        im[k] = z;
      }
    }
  }
  let e = 0;
  const w = Math.min(y.length, Math.floor(sr * 0.25));
  for (let i = 0; i < w; i++) e += y[i] * y[i];
  const k = 0.29 / (Math.sqrt(e / w) || 1);
  for (let i = 0; i < y.length; i++) y[i] *= k;
  return tailFade(y, sr);
}
