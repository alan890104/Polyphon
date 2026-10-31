// Building blocks for offline synthesis: a reproducible random source, an RBJ biquad, and sample clean-up.
// Every sampled instrument is rendered once into a Float32Array with these, then cached; playback costs almost nothing.

/** Reproducible random numbers (the same note comes out the same every time) */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
}

/** RBJ biquad filter */
export class Biquad {
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;
  private sr: number;
  constructor(sr: number, type: 'lp' | 'hp' | 'bp' | 'peak', f: number, q = 0.707, gainDb = 0) {
    this.sr = sr;
    this.set(type, f, q, gainDb);
  }
  set(type: 'lp' | 'hp' | 'bp' | 'peak', f: number, q = 0.707, gainDb = 0): void {
    const w = (2 * Math.PI * Math.min(f, this.sr * 0.45)) / this.sr;
    const cw = Math.cos(w);
    const al = Math.sin(w) / (2 * q);
    let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
    if (type === 'lp') {
      b0 = (1 - cw) / 2;
      b1 = 1 - cw;
      b2 = b0;
      a0 = 1 + al;
      a1 = -2 * cw;
      a2 = 1 - al;
    } else if (type === 'hp') {
      b0 = (1 + cw) / 2;
      b1 = -(1 + cw);
      b2 = b0;
      a0 = 1 + al;
      a1 = -2 * cw;
      a2 = 1 - al;
    } else if (type === 'bp') {
      b0 = al;
      b1 = 0;
      b2 = -al;
      a0 = 1 + al;
      a1 = -2 * cw;
      a2 = 1 - al;
    } else {
      const A = Math.pow(10, gainDb / 40);
      b0 = 1 + al * A;
      b1 = -2 * cw;
      b2 = 1 - al * A;
      a0 = 1 + al / A;
      a1 = -2 * cw;
      a2 = 1 - al / A;
    }
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;
  }
  run(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

export function normalize(d: Float32Array, peak = 0.9): Float32Array {
  let mx = 0;
  for (let i = 0; i < d.length; i++) mx = Math.max(mx, Math.abs(d[i]));
  if (mx > 0) {
    const k = peak / mx;
    for (let i = 0; i < d.length; i++) d[i] *= k;
  }
  return d;
}

/** 10 ms fade-out at the tail to avoid a click from truncation */
export function tailFade(d: Float32Array, sr: number): Float32Array {
  const n = Math.min(d.length, Math.floor(sr * 0.01));
  for (let i = 0; i < n; i++) d[d.length - 1 - i] *= i / n;
  return d;
}
