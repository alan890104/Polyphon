// Procedural surface textures, painted on a canvas (no image files): figured walnut for the case, aged paper for the inside of the
// lid, and a soft mottle for the leather. Seeded, so every visit shows the same wood. Painting takes a few rows at a time between
// frames, so the page never stalls while the room is built, and happens once per visit.

import { CanvasTexture, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, SRGBColorSpace, type ColorSpace } from 'three';

/** Walnut: dark heartwood with wandering growth rings and fine pores running along the grain (x) */
export async function walnutTexture(): Promise<CanvasTexture> {
  return textureOf(await once('walnut', () => paintWalnut(1024)), SRGBColorSpace, false);
}

/** Aged laid paper: warm ivory, mottled, foxed here and there, darker towards its edges, with a ruled sepia border */
export async function paperTexture(): Promise<CanvasTexture> {
  return textureOf(await once('paper', () => paintPaper(1024)), SRGBColorSpace, false);
}

/** A soft grey mottle, tiling: the leather's roughness */
export async function mottleTexture(): Promise<CanvasTexture> {
  return textureOf(await once('mottle', () => paintMottle(256)), NoColorSpace, true);
}

/** Each canvas is painted once per visit and shared by every music box after (the view opens again at once) */
const painted = new Map<string, Promise<HTMLCanvasElement>>();

function once(name: string, paint: () => Promise<HTMLCanvasElement>): Promise<HTMLCanvasElement> {
  let canvas = painted.get(name);
  if (!canvas) painted.set(name, (canvas = paint()));
  return canvas;
}

function textureOf(canvas: HTMLCanvasElement, colorSpace: ColorSpace, repeat: boolean): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = colorSpace;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = 8;
  if (repeat) texture.wrapS = texture.wrapT = RepeatWrapping;
  return texture;
}

function paintWalnut(size: number): Promise<HTMLCanvasElement> {
  const noise = valueNoise(7);
  return paint(size, size, (x, y) => {
    const u = x / size;
    const v = y / size;
    // Rings: the grain's distance across the board, warped so the figure wanders
    const warp = fbm(noise, u * 3, v * 9, 4) * 2.2 + fbm(noise, u * 0.7 + 9, v * 2, 3) * 3;
    const band = Math.pow(0.5 + 0.5 * Math.sin((v * 14 + warp) * Math.PI * 2), 3);
    // Pores: fine dark streaks stretched along the grain
    const pore = Math.max(0, fbm(noise, u * 40, v * 900, 2) - 0.58) * 2.4;
    const figure = fbm(noise, u * 5 + 3, v * 1.5, 3);
    return mixRgb([46, 27, 17], [100, 63, 38], clamp01(0.4 + band * 0.22 + (figure - 0.5) * 0.35 - pore * 0.35));
  });
}

async function paintPaper(size: number): Promise<HTMLCanvasElement> {
  const noise = valueNoise(3);
  const canvas = await paint(size, size, (x, y) => {
    const u = x / size;
    const v = y / size;
    const mottle = fbm(noise, u * 6, v * 6, 4);
    const fox = Math.max(0, fbm(noise, u * 22 + 5, v * 22, 3) - 0.7) * 3.5;
    const laid = 0.5 + 0.5 * Math.sin(v * size * 0.9);
    const edge = Math.min(u, v, 1 - u, 1 - v);
    return mixRgb([168, 132, 88], [232, 212, 172], clamp01(0.62 + (mottle - 0.5) * 0.45 - fox * 0.25 - laid * 0.02 - Math.max(0, 0.08 - edge) * 2.5));
  });
  const g = canvas.getContext('2d')!;
  g.strokeStyle = 'rgba(92, 58, 32, 0.55)';
  for (const [inset, width] of [[0.06, 3.2], [0.074, 1.2]] as const) {
    g.lineWidth = width * (size / 1024);
    g.strokeRect(inset * size, inset * size, (1 - 2 * inset) * size, (1 - 2 * inset) * size);
  }
  return canvas;
}

function paintMottle(size: number): Promise<HTMLCanvasElement> {
  const noise = valueNoise(11, 16);
  return paint(size, size, (x, y) => {
    const c = Math.round(255 * clamp01(0.3 + fbm(noise, (x / size) * 16, (y / size) * 16, 5, 2) * 0.6));
    return [c, c, c];
  });
}

type Rgb = [number, number, number];

/** Milliseconds of painting between frames */
const SLICE_MS = 8;

async function paint(width: number, height: number, color: (x: number, y: number) => Rgb): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d')!;
  const image = g.createImageData(width, height);
  const data = image.data;
  let began = performance.now();
  for (let y = 0, i = 0; y < height; y++) {
    for (let x = 0; x < width; x++, i += 4) {
      const [r, gg, b] = color(x, y);
      data[i] = r;
      data[i + 1] = gg;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
    if (performance.now() - began > SLICE_MS) {
      await new Promise((resolve) => setTimeout(resolve));
      began = performance.now();
    }
  }
  g.putImageData(image, 0, 0);
  return canvas;
}

/** 2D value noise on a lattice that wraps every `period` cells (so textures tile), seeded */
function valueNoise(seed: number, period = 256): (x: number, y: number) => number {
  const n = 256;
  const table = new Float32Array(n * n);
  let s = seed * 9301 + 49297;
  for (let i = 0; i < table.length; i++) {
    s = (s * 233280 + 49297) % 2147483647;
    table[i] = (s % 10000) / 10000;
  }
  const p = Math.max(1, Math.min(n, Math.round(period)));
  const at = (ix: number, iy: number) => table[(((iy % p) + p) % p) * n + (((ix % p) + p) % p)];
  return (x, y) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * sx;
    const b = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * sx;
    return a + (b - a) * sy;
  };
}

/** Octaves of noise; a lacunarity of exactly 2 keeps a wrapping lattice tiling */
function fbm(noise: (x: number, y: number) => number, x: number, y: number, octaves: number, lacunarity = 2.03): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += noise(x, y) * amp;
    norm += amp;
    x *= lacunarity;
    y *= lacunarity;
    amp *= 0.5;
  }
  return sum / norm;
}

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}
