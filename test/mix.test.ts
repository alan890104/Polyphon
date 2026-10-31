import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compileSection, defineSong, Playback, registerInstrument, rhythm, type Song } from 'polyphon';
import { breakpoints, cutoffAt, duckLevel } from '../src/engine/automation.ts';
import { mastersItself } from '../src/engine/output.ts';

registerInstrument('testHit', { play: () => {} });

type Event = [string, ...number[]];
type FakeNode = Record<string, unknown> & { gain: { events: Event[] }; frequency: { events: Event[] } };

/** A stand-in for an AudioContext, enough for a Playback: nodes take any connection, and every AudioParam records what is scheduled on it */
function fakeContext(): { ctx: BaseAudioContext; nodes: FakeNode[] } {
  const nodes: FakeNode[] = [];
  const param = () => {
    const events: Event[] = [];
    const record = (name: string) => (...args: number[]) => void events.push([name, ...args]);
    const methods = ['setValueAtTime', 'setTargetAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'cancelScheduledValues'];
    return { value: 0, events, ...Object.fromEntries(methods.map((m) => [m, record(m)])) };
  };
  const node = () => {
    const fields: Record<string, unknown> = { context: ctx, connect: (to: unknown) => to, disconnect() {}, start() {}, stop() {} };
    const n = new Proxy(fields, { get: (t, k: string) => (k in t ? t[k] : (t[k] = param())) }) as FakeNode;
    nodes.push(n);
    return n;
  };
  const fields: Record<string, unknown> = { currentTime: 0, sampleRate: 44100, createBuffer: (_: number, length: number) => ({ getChannelData: () => new Float32Array(length) }) };
  const ctx = new Proxy(fields, { get: (t, k: string) => (k in t ? t[k] : node) });
  ctx.destination = node();
  return { ctx: ctx as unknown as BaseAudioContext, nodes };
}

/** Events with their numbers rounded to the microsecond */
const rounded = (events: Event[]) => events.map(([m, ...args]): Event => [m, ...args.map((x) => +x.toFixed(6))]);
/** What is scheduled on a track's duck gain (its output, when it ducks) */
const duckEvents = (playback: Playback, section: string, name: string) =>
  rounded((playback.tracks.find((t) => t.section === section && t.name === name)!.output as unknown as FakeNode).gain.events);
/** When the hits a track ducked under landed: each dip starts 4 ms ahead of its hit */
const hits = (events: Event[]) => events.filter(([m, v]) => m === 'setTargetAtTime' && v < 1).map(([, , t]) => +(t + 0.004).toFixed(6));
/** What is scheduled on the cutoffs of the low-pass filters (two stages each) */
const lowpassEvents = (nodes: FakeNode[]) => nodes.filter((n) => n.type === 'lowpass').map((n) => rounded(n.frequency.events));

// 120 bpm: a step is 0.125 s and a bar 2 s. The intro is one bar, the body one bar; the playbacks start at 1 s, so the body at 3 s
const song = defineSong({
  title: 'Pump',
  bpm: 120,
  intro: [
    { name: 'Kick', instrument: 'testHit', part: rhythm('x...x...x...x...') },
    { name: 'Pad', instrument: 'testHit', part: 'C4:16 |', duck: 'Kick' },
  ],
  tracks: [
    { name: 'Kick', instrument: 'testHit', part: rhythm('x.......x.......') },
    // The sweep runs past the end of the section: four octaves over two bars, so it reaches two octaves up at the end of the one bar
    { name: 'Pad', instrument: 'testHit', part: 'C4:16 |', duck: { by: 'Kick', depth: 0.5, release: 2 }, lowpass: { 0: 200, 32: 3200 } },
  ],
});

test('a track ducks under every track with the name it gives, in its own section; an unknown name fails', () => {
  const tracks: Song['tracks'] = [
    { name: 'Kick', instrument: 'kick', part: 'C2:4 r:12 |' },
    { name: 'Bass', instrument: 'bass', part: 'C2:16 |', duck: 'Kick' },
    { instrument: 'kick', part: 'C2:4 r:12 |' },
    { name: 'Pad', instrument: 'warmPad', part: 'C4:16 |', duck: { by: 'kick', depth: 0.5 } },
  ];
  assert.deepEqual(compileSection(tracks, 16).ducks, [[1], [], [3], []]);
  assert.throws(() => compileSection([{ instrument: 'bass', part: 'C2:16 |', duck: 'Kik' }], 16), /"bass" ducks under "Kik", but no other track/);
});

test('pumps follow the kick through the intro and every loop, even with the kick muted, and pick up mid-swell after a seek', () => {
  const { ctx } = fakeContext();
  const playback = new Playback(ctx, ctx.destination, song, { at: 1, loops: 2 });
  for (const t of playback.tracks) if (t.name === 'Kick') t.muted = true;
  playback.schedule(100);
  assert.deepEqual(hits(duckEvents(playback, 'intro', 'Pad')), [1, 1.5, 2, 2.5]);
  assert.deepEqual(hits(duckEvents(playback, 'loop', 'Pad')), [3, 4, 5, 6]);
  // Down to 1 - depth just before the hit; back up from a quarter of the release on (4 steps by default, 2 here)
  assert.deepEqual(duckEvents(playback, 'loop', 'Pad').slice(0, 2), [
    ['setTargetAtTime', 0.5, 2.996, 0.001333],
    ['setTargetAtTime', 1, 3.0625, 0.0625],
  ]);

  // Seek to 0.1 s after the body's second hit: the swell is already under way
  const seeked = new Playback(ctx, ctx.destination, song, { at: 10, from: 2 + 1.1, loops: 2 });
  seeked.schedule(100);
  const events = duckEvents(seeked, 'loop', 'Pad');
  assert.deepEqual(events.slice(0, 2), [
    ['setValueAtTime', +duckLevel(0.5, 0.25, 0.1).toFixed(6), 10],
    ['setTargetAtTime', 1, 10, 0.0625],
  ]);
  assert.deepEqual(hits(events), [10.9, 11.9]);
});

test('a tempo change moves every hit after it; each pass of the body plays it again, and a seek lands in the right place', () => {
  // The intro (bar 1) at 120 bpm, a beat every 0.5 s; the body (bar 2) at 60, a half note every 2 s. Starting at 1 s, the body starts at 3 s
  const slower = defineSong({ ...song, tempo: [{ bar: 2, bpm: 60 }], tracks: song.tracks.map(({ lowpass, ...track }) => track) });
  const { ctx } = fakeContext();
  const playback = new Playback(ctx, ctx.destination, slower, { at: 1, loops: 2 });
  playback.schedule(100);
  assert.equal(playback.loopDuration, 4);
  assert.deepEqual(hits(duckEvents(playback, 'intro', 'Pad')), [1, 1.5, 2, 2.5]);
  assert.deepEqual(hits(duckEvents(playback, 'loop', 'Pad')), [3, 5, 7, 9]);
  assert.deepEqual(playback.position(1 + 2 + 4 + 2.5), { seconds: 8.5, section: 'loop', bar: 1, loop: 1 });

  // 2.5 s into the body is past its second hit: the next ones come with the second pass
  const seeked = new Playback(ctx, ctx.destination, slower, { at: 10, from: 2 + 2.5, loops: 2 });
  seeked.schedule(100);
  assert.deepEqual(hits(duckEvents(seeked, 'loop', 'Pad')), [11.5, 13.5]);
});

test('a sweep holds before its first breakpoint and after its last, and glides evenly in pitch between', () => {
  const points = breakpoints({ 64: 3200, 0: 200, 32: 200 });
  assert.deepEqual(points, [[0, 200], [32, 200], [64, 3200]]);
  assert.equal(cutoffAt(points, 16), 200);
  assert.equal(cutoffAt(points, 48), 800); // halfway in steps is halfway in octaves
  assert.equal(cutoffAt(points, 80), 3200);
});

test('every pass of a section restarts its sweeps, gliding back in 20 ms, and a seek starts them mid-glide', () => {
  const first = (start: number) => [['setValueAtTime', 200, start], ['exponentialRampToValueAtTime', 800, start + 2]];
  const again = (start: number) => [['setValueAtTime', 800, start], ['exponentialRampToValueAtTime', 200, start + 0.02], ['exponentialRampToValueAtTime', 800, start + 2]];
  const played = fakeContext();
  new Playback(played.ctx, played.ctx.destination, song, { at: 1, loops: 2 }).schedule(100);
  const expected = [...first(3), ...again(5)];
  assert.deepEqual(lowpassEvents(played.nodes), [expected, expected]);

  // From halfway through the body: one octave up, gliding on to two
  const seeked = fakeContext();
  new Playback(seeked.ctx, seeked.ctx.destination, song, { at: 10, from: 3, loops: 2 }).schedule(100);
  const fromSeek = [['setValueAtTime', 400, 10], ['exponentialRampToValueAtTime', 800, 11], ...again(11)];
  assert.deepEqual(lowpassEvents(seeked.nodes), [fromSeek, fromSeek]);
});

test('a silence shuts the gate after the reverb on every pass, opens it just before the music returns, and holds it shut after a seek into it', () => {
  // The last beat of the intro, and the third beat of the body
  const stops = { ...song, silences: [{ bar: 1.75, beats: 1 }, { bar: 2.5, beats: 1 }] };
  const gateEvents = (nodes: FakeNode[]) => nodes.filter((n) => n.gain.events.some(([m, v]) => m === 'linearRampToValueAtTime' && v === 0)).map((n) => rounded(n.gain.events));
  const silence = (start: number, end: number) => [['setValueAtTime', 1, start], ['linearRampToValueAtTime', 0, start + 0.01], ['setValueAtTime', 0, end - 0.009], ['linearRampToValueAtTime', 1, end - 0.005]];
  const played = fakeContext();
  new Playback(played.ctx, played.ctx.destination, stops, { at: 1, loops: 2 }).schedule(100);
  assert.deepEqual(gateEvents(played.nodes), [[...silence(2.5, 3), ...silence(4, 4.5), ...silence(6, 6.5)]]);

  // From a quarter of a second into the body's silence: shut at once, then the next pass as usual
  const seeked = fakeContext();
  new Playback(seeked.ctx, seeked.ctx.destination, stops, { at: 10, from: 3.25, loops: 2 }).schedule(100);
  const shut = [['setValueAtTime', 0, 10], ['setValueAtTime', 0, 10.241], ['linearRampToValueAtTime', 1, 10.245]];
  assert.deepEqual(gateEvents(seeked.nodes), [[...shut, ...silence(11.75, 12.25)]]);
});

test('songs mastered loud bypass the shared output limiter; the others go through it', () => {
  assert.equal(mastersItself(song), false);
  assert.equal(mastersItself({ ...song, master: { warm: 2, glue: 0.4 } }), false);
  assert.equal(mastersItself({ ...song, master: { loud: 0 } }), true);
  assert.equal(mastersItself({ ...song, master: { glue: 0.5, loud: 9 } }), true);
});
