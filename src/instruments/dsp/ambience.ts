// Ambience beds: stereo noise textures rendered once and looped seamlessly (wind, sea, fire, crickets, rain, void, cave).

import { Biquad, normalize, rng } from './core.ts';

/** Crossfade the tail into the beginning, making a sample that loops seamlessly */
function seamless(y: Float32Array, sr: number, xf = 1): Float32Array {
  const n = Math.floor(xf * sr);
  const out = y.slice(0, y.length - n);
  for (let i = 0; i < n; i++) {
    const k = i / n;
    out[i] = out[i] * Math.sqrt(k) + y[y.length - n + i] * Math.sqrt(1 - k);
  }
  return out;
}

/** Band-pass noise that varies over time: centers(t) gives the center frequency */
function movingBand(y: Float32Array, sr: number, seed: number, q: number, amp: number, center: (t: number) => number, gain: (t: number) => number = () => 1): void {
  const r = rng(seed);
  const bq = new Biquad(sr, 'bp', center(0), q);
  for (let i = 0; i < y.length; i++) {
    if (i % 64 === 0) bq.set('bp', center(i / sr), q);
    y[i] += bq.run(r()) * amp * gain(i / sr);
  }
}

const smoothWalk = (seed: number, len: number, step: number) => {
  const r = rng(seed);
  const pts = Array.from({ length: Math.ceil(len / step) + 2 }, () => Math.abs(r()));
  pts[pts.length - 1] = pts[0];
  return (t: number) => {
    const x = t / step;
    const i = Math.floor(x);
    const k = x - i;
    const a = pts[i % pts.length];
    const b = pts[(i + 1) % pts.length];
    return a + (b - a) * (0.5 - 0.5 * Math.cos(Math.PI * k));
  };
};

export const AMB = {
  /** Wind: two band-pass noises that wander slowly in frequency, with an occasional strong gust */
  wind: (sr, s) => {
    const len = 13;
    const y = new Float32Array(Math.floor(sr * len));
    const w1 = smoothWalk(s, len, 1.3);
    const w2 = smoothWalk(s + 5, len, 0.9);
    const gust = smoothWalk(s + 9, len, 2.2);
    movingBand(y, sr, s, 3, 1, (t) => 350 + w1(t) * 900, (t) => 0.4 + gust(t));
    movingBand(y, sr, s + 1, 9, 0.8, (t) => 1100 + w2(t) * 1800, (t) => 0.2 + gust(t) * gust(t));
    return seamless(normalize(y), sr, 1.5);
  },
  /** Sea: low surging waves (period 5.5 s) + the hiss of spray */
  sea: (sr, s) => {
    const period = 5.5;
    const len = period * 2 + 1.5;
    const y = new Float32Array(Math.floor(sr * len));
    const r = rng(s);
    const lp = new Biquad(sr, 'lp', 420, 0.6);
    const hp = new Biquad(sr, 'hp', 3000, 0.5);
    for (let i = 0; i < y.length; i++) {
      const t = i / sr;
      const ph = (t % period) / period;
      const swell = 0.25 + 0.75 * Math.pow(Math.sin(Math.PI * ph), 2);
      const foam = Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (ph - 0.35) / 0.4)))) ** 3;
      const x = r();
      y[i] = lp.run(x) * swell * 1.4 + hp.run(x) * foam * 0.25;
    }
    return seamless(normalize(y), sr, 1.5);
  },
  /** Fire: low-frequency roar + random crackles */
  fire: (sr, s) => {
    const len = 9;
    const y = new Float32Array(Math.floor(sr * len));
    const r = rng(s);
    const lp = new Biquad(sr, 'lp', 160, 0.8);
    const roar = smoothWalk(s + 2, len, 0.7);
    for (let i = 0; i < y.length; i++) y[i] = lp.run(r()) * (0.6 + 0.6 * roar(i / sr)) * 2.2;
    for (let t = 0.05; t < len - 1.2; t += 0.03 + Math.abs(r()) * 0.3) {
      const bq = new Biquad(sr, 'bp', 1800 + Math.abs(r()) * 3500, 2);
      const a = 0.15 + Math.abs(r()) * 0.45;
      const i0 = Math.floor(t * sr);
      for (let j = 0; j < sr * 0.03 && i0 + j < y.length; j++) y[i0 + j] += bq.run(r()) * a * Math.exp(-j / (sr * 0.004));
    }
    return seamless(normalize(y), sr, 1);
  },
  /** Crickets: 4.4 kHz pulses, in bursts */
  crickets: (sr, s) => {
    const len = 8;
    const y = new Float32Array(Math.floor(sr * len));
    const r = rng(s);
    for (const [hz, rate, amp] of [[4400, 28, 1], [5100, 34, 0.6]] as const) {
      let ph = 0;
      let on = 0;
      for (let i = 0; i < y.length; i++) {
        const t = i / sr;
        if (i % Math.floor(sr * 0.45) === 0) on = Math.abs(r()) > 0.4 ? 1 : 0;
        ph += (2 * Math.PI * hz) / sr;
        const pulse = Math.sin(Math.PI * ((t * rate) % 1)) ** 4;
        y[i] += Math.sin(ph) * pulse * on * amp;
      }
    }
    const lp = new Biquad(sr, 'lp', 6000, 0.7);
    for (let i = 0; i < y.length; i++) y[i] = lp.run(y[i]);
    return seamless(normalize(y), sr, 0.6);
  },
  /** Rain: the hiss of high-frequency noise + scattered water drops */
  rain: (sr, s) => {
    const len = 8;
    const y = new Float32Array(Math.floor(sr * len));
    const r = rng(s);
    const hp = new Biquad(sr, 'hp', 1800, 0.5);
    const lp = new Biquad(sr, 'lp', 9000, 0.5);
    for (let i = 0; i < y.length; i++) y[i] = lp.run(hp.run(r())) * 0.5;
    for (let t = 0.1; t < len - 1; t += 0.01 + Math.abs(r()) * 0.06) {
      const i0 = Math.floor(t * sr);
      const a = Math.abs(r()) * 0.6;
      for (let j = 0; j < 200 && i0 + j < y.length; j++) y[i0 + j] += r() * a * Math.exp(-j / 30);
    }
    return seamless(normalize(y), sr, 1);
  },
  /** Void: slowly moving narrow-band noise, low-frequency sines in a tritone */
  void: (sr, s) => {
    const len = 14;
    const y = new Float32Array(Math.floor(sr * len));
    const w = smoothWalk(s, len, 3.5);
    movingBand(y, sr, s, 14, 2.5, (t) => 110 + w(t) * 500);
    for (const [hz, a] of [[55, 0.35], [77.8, 0.2], [110.3, 0.12]] as const) {
      const k = Math.round(hz * (len - 2)) / (len - 2);
      for (let i = 0; i < y.length; i++) y[i] += Math.sin((2 * Math.PI * k * i) / sr) * a * (0.6 + 0.4 * Math.sin((2 * Math.PI * i) / sr / 7));
    }
    return seamless(normalize(y), sr, 2);
  },
  /** Cave: very low air sound */
  cave: (sr, s) => {
    const len = 10;
    const y = new Float32Array(Math.floor(sr * len));
    const w = smoothWalk(s, len, 2.5);
    movingBand(y, sr, s, 1.2, 1, (t) => 90 + w(t) * 120);
    movingBand(y, sr, s + 3, 6, 0.25, (t) => 600 + w(t) * 300);
    return seamless(normalize(y), sr, 1.5);
  },
} satisfies Record<string, (sr: number, seed: number) => Float32Array>;
