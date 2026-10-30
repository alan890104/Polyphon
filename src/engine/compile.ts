// Compile a song's sections into flat, time-sorted note lists, and list the samples a song needs rendered.

import type { SampledInstrument } from '../instruments/definition.ts';
import { getInstrument } from '../instruments/registry.ts';
import { bowLayers, type SampleRequest } from '../instruments/samples.ts';
import { stepsPerBar, type Meter } from '../notation/part.ts';
import { trackPart, type Song } from '../song.ts';

/** A note ready to schedule */
export interface ScheduledNote {
  /** Steps from the start of the section */
  time: number;
  duration: number;
  pitches: number[];
  velocity: number;
  /** Index of the track in its section */
  track: number;
  /** Glides merged into this note: [steps after its start, target MIDI pitch] */
  bends?: [number, number][];
  strum?: number;
}

export interface CompiledSection {
  /** Length in steps (whole bars) */
  duration: number;
  notes: ScheduledNote[];
}

/** Compile one section into sorted notes; shorter tracks repeat to fill the whole section */
export function compileSection(tracks: Song['tracks'], meter: Meter): CompiledSection {
  const bar = stepsPerBar(meter);
  const parts = tracks.map((t) => trackPart(t, meter));
  const longest = Math.max(bar, ...parts.map((p) => p.duration));
  const duration = Math.ceil(longest / bar - 1e-6) * bar;
  const notes: ScheduledNote[] = [];
  tracks.forEach((track, ti) => {
    const p = parts[ti];
    if (!p.duration) return;
    const reps = track.repeat === false ? 1 : Math.max(1, Math.floor(duration / p.duration + 1e-6));
    const src = [...p.notes].sort((a, b) => a.time - b.time);
    const glides = getInstrument(track.instrument).glide ?? false;
    for (let r = 0; r < reps; r++) {
      const off = r * p.duration;
      for (let i = 0; i < src.length; i++) {
        const n = src[i];
        if (n.time + off >= duration) break;
        const c: ScheduledNote = { time: n.time + off, duration: n.duration, pitches: n.pitches, velocity: n.velocity, track: ti, strum: n.strum };
        // Glide: merge the following notes in, turning them into pitch changes of the same voice
        if (glides && n.glide) {
          c.bends = [];
          let j = i;
          while (src[j]?.glide && src[j + 1]) {
            const next = src[j + 1];
            c.bends.push([next.time - n.time, next.pitches[0]]);
            c.duration = next.time + next.duration - n.time;
            j++;
          }
          i = j;
        }
        notes.push(c);
      }
    }
  });
  notes.sort((a, b) => a.time - b.time);
  return { duration, notes };
}

/** Every sample a song will play, so they can be rendered before it starts */
export function sampleRequests(song: Song): SampleRequest[] {
  const out = new Map<string, SampleRequest>();
  const meter = song.meter ?? 16;
  for (const track of [...(song.intro ?? []), ...song.tracks]) {
    const def = getInstrument(track.instrument);
    if (def.kind !== 'sample') continue;
    for (const n of trackPart(track, meter).notes) {
      for (const m of n.pitches.length ? n.pitches : [0]) {
        const midi = m + (track.transpose ?? 0);
        if (def.bow) {
          // Bowed strings: only the velocity layers that will be used
          for (const layer of bowLayers(def, n.velocity, track.params?.bright)) out.set(`${track.instrument}|${midi}|${layer}`, request(def, track.instrument, midi, layer));
        } else out.set(`${track.instrument}|${midi}`, request(def, track.instrument, midi));
      }
    }
  }
  return [...out.values()];
}

const request = (def: SampledInstrument, name: string, midi: number, layer?: number): SampleRequest => ({ def, name, midi, layer });
