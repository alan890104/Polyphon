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

/** Brass stab: a short note where the filter blows open quickly and then closes again */
export function brassStab(sr: number, m: number): Float32Array {
  const f = 440 * Math.pow(2, (m - 69) / 12);
  const y = new Float32Array(Math.floor(sr * 0.55));
  const nyq = sr * 0.42;
  const r = rng(m * 3 + 9);
  const cut = (t: number) => f * (1.2 + 5 * Math.min(1, t / 0.035) * Math.exp(-t / 0.35));
  for (const det of [-6, 6]) {
    const ff = f * Math.pow(2, det / 1200);
    for (let k = 1; k < 36; k++) {
      const hz = ff * k;
      if (hz > nyq) break;
      const w = (2 * Math.PI * hz) / sr;
      let ph = r() * Math.PI;
      for (let i = 0; i < y.length; i++) {
        ph += w;
        const c = cut(i / sr);
        y[i] += (Math.sin(ph) / Math.pow(k, 1.05)) / (1 + (hz / c) ** 2);
      }
    }
  }
  for (let i = 0; i < y.length; i++) {
    const t = i / sr;
    y[i] *= Math.min(1, t / 0.012) * Math.exp(-t / 0.28);
  }
  return tailFade(normalize(y), sr);
}
