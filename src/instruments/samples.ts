// Sample cache: sampled instruments are rendered once per (sample rate, instrument, pitch, variant) and reused.
// Rendering happens before a song starts (prepareSamples), in small slices so the main thread never stalls.

import type { SampledInstrument } from './definition.ts';

/** A sample a song needs rendered before it plays */
export interface SampleRequest {
  def: SampledInstrument;
  name: string;
  midi: number;
  /** Only this layer (bowed strings pick soft or hard by velocity) */
  layer?: number;
}

const cache = new Map<string, AudioBuffer>();
/** Loop section of a bowed-string sample (seconds) */
const loops = new WeakMap<AudioBuffer, [number, number]>();

/** Bowed samples share a cache entry when one instrument borrows another's players (strPad uses strings) */
const sampleName = (def: SampledInstrument, name: string) => def.bow?.name ?? name;
const keyOf = (sampleRate: number, name: string, midi: number, variant: number) => `${sampleRate}|${name}|${midi}|${variant}`;

/** The pitch actually rendered: bowed strings sample every few semitones, fixed-pitch drums always use one note */
export function sampleMidi(def: SampledInstrument, midi: number): number {
  if (def.bow) return Math.round(midi / def.bow.zone) * def.bow.zone;
  return def.fixed ?? Math.round(midi);
}

/** How much memory bowed-string samples may take at most (bytes): beyond that the least recently used are dropped (notes already playing still hold a reference, so they are unaffected) */
const BOW_BUDGET = 48e6;
const bowUse = new Map<string, number>();
let bowBytes = 0;
function keepBow(key: string, buffer: AudioBuffer): void {
  if (!bowUse.has(key)) bowBytes += buffer.length * 4;
  bowUse.delete(key);
  bowUse.set(key, buffer.length * 4);
  for (const [old, n] of bowUse) {
    if (bowBytes <= BOW_BUDGET) break;
    bowUse.delete(old);
    cache.delete(old);
    bowBytes -= n;
  }
}

/** Which layer a bowed string uses at this velocity (times params.bright); near the threshold both layers are prepared (velocity has a little randomness at playback) */
export function bowLayers(def: SampledInstrument, velocity: number, bright = 1): number[] {
  const x = velocity * bright;
  const at = def.bow!.loudAt;
  if (Math.abs(x - at) < 0.06) return [0, 1];
  return [x > at ? 1 : 0];
}

/** How many variants of a sampled instrument to precompute (random variants for drums; the soft and hard layers for bowed strings) */
export const variantsOf = (def: SampledInstrument): number => (def.bow ? 2 : (def.variants ?? 1));

/** Whether a sample is already rendered */
export function hasSample(sampleRate: number, def: SampledInstrument, name: string, midi: number, variant: number): boolean {
  return cache.has(keyOf(sampleRate, sampleName(def, name), sampleMidi(def, midi), variant));
}

/** The loop section (seconds) of a bowed sample, if it has one */
export const loopOf = (buffer: AudioBuffer): [number, number] | undefined => loops.get(buffer);

/** Render (or fetch from the cache) a sample */
export function getSample(ctx: BaseAudioContext, def: SampledInstrument, name: string, midi: number, variant = 0): AudioBuffer {
  const mm = sampleMidi(def, midi);
  const v = variant % variantsOf(def);
  const k = keyOf(ctx.sampleRate, sampleName(def, name), mm, v);
  let b = cache.get(k);
  if (!b) {
    const sr = def.bow ? Math.round(ctx.sampleRate * def.bow.rate) : ctx.sampleRate;
    const data = def.render(sr, mm, v);
    const chans = data instanceof Float32Array ? [data] : Array.isArray(data) ? data : [data.data];
    b = ctx.createBuffer(chans.length, chans[0].length, sr);
    chans.forEach((d, i) => b!.getChannelData(i).set(d));
    if (!(data instanceof Float32Array) && !Array.isArray(data)) loops.set(b, [data.loop[0] / sr, data.loop[1] / sr]);
    cache.set(k, b);
  }
  if (def.bow) keepBow(k, b);
  return b;
}

/** Drop every cached sample of an instrument (after it is redefined) */
export function forgetSamples(name: string): void {
  for (const k of [...cache.keys()]) if (k.split('|')[1] === name) cache.delete(k);
}

/** Every [variant] of a need that should be rendered */
function* variantsToRender(def: SampledInstrument, layer: number | undefined): Generator<number> {
  for (let v = 0; v < variantsOf(def); v++) if (layer === undefined || v === layer) yield v;
}

/** Render samples ahead of time; after more than 12 ms of continuous work, yield the main thread for a moment (so the screen does not stall) */
export async function prepareSamples(ctx: BaseAudioContext, requests: Iterable<SampleRequest>): Promise<void> {
  let last = performance.now();
  for (const { def, name, midi, layer } of requests) {
    for (const v of variantsToRender(def, layer)) {
      if (hasSample(ctx.sampleRate, def, name, midi, v)) continue;
      getSample(ctx, def, name, midi, v);
      if (performance.now() - last > 12) {
        await new Promise((r) => setTimeout(r, 0));
        last = performance.now();
      }
    }
  }
}

/** Synchronous version (offline rendering, short play-once jingles) */
export function prepareSamplesSync(ctx: BaseAudioContext, requests: Iterable<SampleRequest>): void {
  for (const { def, name, midi, layer } of requests) for (const v of variantsToRender(def, layer)) getSample(ctx, def, name, midi, v);
}
