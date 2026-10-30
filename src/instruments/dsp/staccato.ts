// Short sampled notes for fast figures (much cheaper than live synthesis): spiccato strings and brass stabs.

import { Biquad, normalize, rng, tailFade } from './core.ts';

/** Spiccato strings: a set of detuned sawtooth harmonics, body resonance, the rustle of the bow hair, very short */
export function spicc(sr: number, m: number): Float32Array {
  const f = 440 * Math.pow(2, (m - 69) / 12);
  const y = new Float32Array(Math.floor(sr * 0.42));
  const nyq = sr * 0.42;
  const body = (hz: number) => 0.4 + 1.2 / (1 + ((hz - 450) / 250) ** 2) + 0.7 / (1 + ((hz - 1300) / 500) ** 2) + 0.5 / (1 + ((hz - 3000) / 900) ** 2);
  const r = rng(m * 5 + 1);
  for (const det of [-7, 0, 7]) {
    const ff = f * Math.pow(2, det / 1200);
    for (let k = 1; k < 40; k++) {
      const hz = ff * k;
      if (hz > nyq) break;
      const amp = (body(hz) / k) / (1 + (hz / 4500) ** 2);
      const w = (2 * Math.PI * hz) / sr;
      let ph = r() * Math.PI;
      for (let i = 0; i < y.length; i++) {
        ph += w;
        y[i] += Math.sin(ph) * amp;
      }
    }
  }
  const noise = new Biquad(sr, 'bp', Math.min(7000, f * 5), 1.2);
  for (let i = 0; i < y.length; i++) {
    const t = i / sr;
    const env = Math.min(1, t / 0.008) * (0.25 + 0.75 * Math.exp(-t / 0.06)) * Math.exp(-t / 0.22);
    y[i] = y[i] * env + noise.run(r()) * 0.6 * Math.exp(-t / 0.03);
  }
  return tailFade(normalize(y), sr);
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
