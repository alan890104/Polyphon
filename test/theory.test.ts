import assert from 'node:assert/strict';
import { test } from 'node:test';
import { frequency, midi, noteName, parseChord, remapToMode, romanChord, scaleDegree, voiceChord } from 'polyphon';

test('note names and MIDI numbers convert both ways', () => {
  assert.equal(midi('C4'), 60);
  assert.equal(midi('A4'), 69);
  assert.equal(midi('Bb3'), 58);
  assert.equal(midi('F##2'), 43);
  assert.equal(midi(72), 72);
  assert.equal(noteName(61), 'C#4');
  assert.equal(frequency('A4'), 440);
  assert.throws(() => midi('H4'), /Unrecognized note name/);
});

test('chord symbols: qualities, slash basses and errors', () => {
  const c = parseChord('F#m7b5');
  assert.deepEqual([c.root, c.intervals, c.third], [6, [0, 3, 6, 10], 3]);
  assert.equal(parseChord('C/E').bass, 4);
  assert.deepEqual(parseChord('Dq4').intervals, [0, 5, 10, 15]);
  assert.throws(() => parseChord('Cmaj13'), /Unrecognized chord quality/);
});

test('voiceChord keeps the requested size and follows the previous voicing', () => {
  const c = voiceChord(parseChord('C'), { center: 'C4' });
  const f = voiceChord(parseChord('F'), { center: 'C4', previous: c });
  assert.equal(c.length, 3);
  assert.ok(f.reduce((s, m, i) => s + Math.abs(m - c[i]), 0) <= 3);
  assert.equal(voiceChord(parseChord('Cmaj7'), { size: 5 }).length, 5);
});

test('scale degrees, mode remapping and roman numerals', () => {
  assert.equal(scaleDegree('D4', 'dorian', 2), 65);
  assert.equal(scaleDegree('D4', 'dorian', -1), 60);
  // A melody written on C's white keys lands on the same degrees of D Phrygian
  assert.deepEqual([60, 62, 64, 65].map((m) => remapToMode(m, 'D4', 'phrygian')), [62, 63, 65, 67]);
  assert.equal(romanChord('VII', 'D4', 'aeolian'), 'C');
  assert.equal(romanChord('iv7', 'D4', 'aeolian'), 'Gm7');
  assert.equal(romanChord('ii°', 'A4', 'harmonicMinor'), 'Bdim');
});
