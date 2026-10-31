import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defineSong, songDuration, tempoClock } from 'polyphon';

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);

test('tempoClock: a change at once starts with its bar', () => {
  // 120 bpm in 3/4: a step is 0.125 s and a bar 1.5 s; from bar 9 a step is 0.25 s
  const clock = tempoClock({ bpm: 120, meter: '3/4', tempo: [{ bar: 9, bpm: 60 }] });
  close(clock.seconds(96), 12);
  close(clock.seconds(100), 13);
  close(clock.step(13), 100);
  assert.equal(clock.bpm(95), 120);
  assert.equal(clock.bpm(96), 60);
});

test('tempoClock: a glide changes the tempo evenly, and its time is the tempo integrated over it', () => {
  // From bar 2, 120 down to 60 bpm across one 4/4 bar: the bar takes ∫ 15 / bpm = (15 / slope) ln(60 / 120) with slope -3.75 a step
  const clock = tempoClock({ bpm: 120, tempo: [{ bar: 2, bpm: 60, over: 1 }] });
  const glide = 4 * Math.log(2);
  close(clock.seconds(16), 2);
  close(clock.seconds(32), 2 + glide);
  close(clock.seconds(36), 2 + glide + 1);
  assert.equal(clock.bpm(24), 90);
  for (const step of [0, 7, 16, 21.5, 31, 32, 40]) close(clock.step(clock.seconds(step)), step);
});

test('tempoClock: changes can come in any order; overlapping ones and impossible ones fail clearly', () => {
  const clock = tempoClock({ bpm: 100, tempo: [{ bar: 3, bpm: 50 }, { bar: 2, bpm: 200 }] });
  close(clock.seconds(48), 2.4 + 1.2 + 4.8);
  assert.throws(() => tempoClock({ bpm: 100, tempo: [{ bar: 2, bpm: 50, over: 2 }, { bar: 3, bpm: 80 }] }), /bar 3 starts before/);
  assert.throws(() => tempoClock({ bpm: 100, tempo: [{ bar: 2, bpm: 0 }] }), /Invalid tempo change/);
  assert.throws(() => tempoClock({ bpm: 100, tempo: [{ bar: 0, bpm: 90 }] }), /Invalid tempo change/);
});

test('songDuration follows the tempo; each pass of the body plays its changes again', () => {
  const song = defineSong({
    title: 'Slower',
    bpm: 120,
    tempo: [{ bar: 3, bpm: 60 }],
    intro: [{ instrument: 'harp', part: 'C4:16 |' }],
    tracks: [{ instrument: 'piano', part: 'C4:16 | D4:16 |' }],
  });
  // The intro is bar 1; the body is bars 2 and 3, the second at half speed
  assert.deepEqual(songDuration(song), { intro: 2, loop: 2 + 4 });
});
