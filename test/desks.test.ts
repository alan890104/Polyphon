import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { compileSection, defineSong, prepareSongSync } from 'polyphon';
import { sampleRequests } from '../src/engine/compile.ts';
import type { SampledInstrument } from '../src/instruments/definition.ts';
import { getInstrument } from '../src/instruments/registry.ts';
import { getSample, hasSample, type SampleRequest } from '../src/instruments/samples.ts';

/** Enough of an AudioContext to render samples into */
const context = () =>
  ({
    sampleRate: 44100,
    createBuffer: (channels: number, length: number, sampleRate: number) => {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { length, sampleRate, duration: length / sampleRate, getChannelData: (i: number) => data[i] };
    },
  }) as unknown as BaseAudioContext;

const sha = (data: Float32Array) => createHash('sha256').update(Buffer.from(data.buffer, data.byteOffset, data.byteLength)).digest('hex');

test('tracks of a section that share a bowed instrument sit at different desks, round three; the first and every other track at desk 0', () => {
  const desks = (tracks: { instrument: string }[]) => compileSection(tracks.map((t) => ({ ...t, part: 'A4:16 |' })), 16).desks;
  assert.deepEqual(
    desks([
      { instrument: 'violin' },
      { instrument: 'piano' },
      { instrument: 'violin' },
      { instrument: 'strings' },
      // strPad plays the strings' samples, so it is the strings' second desk
      { instrument: 'strPad' },
      { instrument: 'violin' },
      { instrument: 'violin' },
      { instrument: 'cello' },
    ]),
    [0, 0, 1, 0, 1, 2, 0, 0],
  );
  // The same song gives the same desks every time
  assert.deepEqual(desks([{ instrument: 'cello' }, { instrument: 'cello' }]), desks([{ instrument: 'cello' }, { instrument: 'cello' }]));
});

test('a lone bowed track renders the samples it always did; a second track on the instrument adds its own players, rendered up front', () => {
  // Fingerprints of the first desk's renders, taken before desks existed (a deliberate change to the bowed model updates them)
  for (const [name, midi, layer, digest] of [
    ['violin', 69, 0, '60882453fe7f1ba72903775fe3ab1d565effa5f4c897c8522a181666262be8ac'],
    ['strings', 69, 1, '1a6fda9c6686444e11a6e6e1c543d0426d53c09a204fb6193f78875a99ae972b'],
  ] as const) {
    const def = getInstrument(name) as SampledInstrument;
    assert.equal(sha(getSample(context(), def, name, midi, layer).getChannelData(0)), digest, `${name} ${midi}`);
  }

  const line = 'A4:8 E5:8 |';
  const key = (q: SampleRequest) => `${q.name}|${q.midi}|${q.layer}|${q.desk}`;
  const lone = sampleRequests(defineSong({ title: 'One', bpm: 100, tracks: [{ instrument: 'violin', part: line }] })).map(key);
  assert.ok(lone.length && lone.every((k) => k.endsWith('|0')));
  const song = defineSong({ title: 'Two', bpm: 100, tracks: [{ instrument: 'violin', part: line }, { instrument: 'violin', part: line }] });
  const both = sampleRequests(song).map(key);
  assert.deepEqual(both.filter((k) => k.endsWith('|0')), lone);
  assert.deepEqual(both.filter((k) => k.endsWith('|1')), lone.map((k) => k.replace(/\|0$/, '|1')));

  // Preparing the song renders both desks, so playback never has to; the second desk's players are not the first's
  const ctx = context();
  prepareSongSync(ctx, song);
  const def = getInstrument('violin') as SampledInstrument;
  for (const q of sampleRequests(song)) assert.ok(hasSample(ctx.sampleRate, def, 'violin', q.midi, q.layer!, q.desk), key(q));
  const layer = sampleRequests(song)[0].layer!;
  const [first, second] = [0, 1].map((desk) => getSample(ctx, def, 'violin', 69, layer, desk).getChannelData(0));
  assert.notEqual(sha(first), sha(second));
});
