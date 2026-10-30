import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compileSection, defineSong, instrumentNames, melody, registerInstrument, songDuration } from 'polyphon';

test('a section is as long as its longest track; shorter tracks repeat to fill it', () => {
  const s = compileSection(
    [
      { instrument: 'piano', part: 'C4:16 | D4:16 |' },
      { instrument: 'kick', part: melody('C2:4 r:12 |') },
      { instrument: 'harp', part: 'E4:16 |', repeat: false },
    ],
    16,
  );
  assert.equal(s.duration, 32);
  assert.deepEqual(
    s.notes.filter((n) => n.track === 1).map((n) => n.time),
    [0, 16],
  );
  assert.equal(s.notes.filter((n) => n.track === 2).length, 1);
});

test('glides merge into one note only on instruments that can glide', () => {
  const part = 'C5:4> E5:4> G5:8 |';
  const glided = compileSection([{ instrument: 'flute', part }], 16).notes;
  assert.equal(glided.length, 1);
  assert.deepEqual(glided[0].bends, [
    [4, 76],
    [8, 79],
  ]);
  assert.equal(glided[0].duration, 16);
  assert.equal(compileSection([{ instrument: 'piano', part }], 16).notes.length, 3);
});

test('songDuration: intro and one pass of the body, in seconds', () => {
  const song = defineSong({
    title: 'Waltz',
    bpm: 120,
    meter: '3/4',
    intro: [{ instrument: 'harp', part: 'C4:12 |' }],
    tracks: [{ instrument: 'piano', part: 'C4:12 | D4:12 | E4:12 | F4:6' }],
  });
  // 120 bpm: a step is 0.125 s; a 3/4 bar is 12 steps; the body rounds up to 4 whole bars
  assert.deepEqual(songDuration(song), { intro: 1.5, loop: 6 });
});

test('unknown instruments fail with the list of known ones', () => {
  assert.throws(() => compileSection([{ instrument: 'kazoo', part: 'C4:16 |' }], 16), /Unknown instrument "kazoo". Available: .*piano/);
});

test('registered instruments can be used by name', () => {
  registerInstrument('testBeep', { render: (sr) => new Float32Array(sr / 10) });
  registerInstrument('testSynth', { play: () => {}, glide: true });
  assert.ok(instrumentNames().includes('testBeep'));
  assert.equal(compileSection([{ instrument: 'testSynth', part: 'C4:4> D4:12 |' }], 16).notes.length, 1);
});
