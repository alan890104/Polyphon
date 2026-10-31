import assert from 'node:assert/strict';
import { test } from 'node:test';
import { arpeggio, bassline, chords, chordsDuration, mapPitch, melody, pad, pedal, repeat, rest, rhythm, roots, scaleVelocity, sequence, slice, stack, stepsPerBar, strum, transpose } from 'polyphon';

const pitches = (p: { notes: { pitches: number[] }[] }) => p.notes.map((n) => n.pitches);

test('melody: lengths carry over, rests advance time, bars are checked', () => {
  const p = melody('C4:4 D4 E4:8 | r:8 G4:8 |');
  assert.deepEqual(
    p.notes.map((n) => [n.time, n.duration, n.pitches[0]]),
    [
      [0, 4, 60],
      [4, 4, 62],
      [8, 8, 64],
      [24, 8, 67],
    ],
  );
  assert.equal(p.duration, 32);
  assert.throws(() => melody('C4:4 D4:4 |'), /Bar 1 is 8 steps long, expected 16/);
});

test('melody: chords, accents, ghost notes, glides, tuplets and repeats', () => {
  const p = melody('!C4+E4+G4:4 ?D4:4/3 E4:4/3> F4:4/3 (G4:1)*4 R');
  assert.deepEqual(p.notes[0].pitches, [60, 64, 67]);
  assert.equal(p.notes[0].velocity, 1);
  assert.equal(p.notes[1].velocity, 0.42);
  assert.equal(p.notes[2].glide, true);
  assert.ok(Math.abs(p.notes[3].time - (4 + 8 / 3)) < 1e-9);
  assert.equal(p.notes.filter((n) => n.pitches[0] === 67).length, 4);
  assert.equal(p.duration, 4 + 4 + 4 + 16);
});

test('melody: ties hold a note across bar lines', () => {
  const p = melody('C4:8 G4:8~ | G4:4~ G4:4 E4:8 |');
  assert.equal(p.notes.length, 3);
  assert.equal(p.notes[1].time, 8);
  assert.equal(p.notes[1].duration, 16);
  assert.equal(melody('r:4 C4+E4:12~ | C4+E4:4 r:12 |').notes[0].duration, 16);
  assert.throws(() => melody('C4:8~ D4:8 |'), /same pitch/);
  assert.throws(() => melody('C4:8~ r:8 |'), /not a rest/);
  assert.throws(() => melody('C4:16~ |'), /at the end/);
});

test('meters: time signatures map to steps per bar', () => {
  assert.equal(stepsPerBar('4/4'), 16);
  assert.equal(stepsPerBar('3/4'), 12);
  assert.equal(stepsPerBar('6/8'), 12);
  assert.equal(stepsPerBar('7/8'), 14);
  assert.equal(stepsPerBar(20), 20);
  assert.equal(melody('C4:12 |', '3/4').duration, 12);
  assert.throws(() => melody('C4:16 |', '3/4'), /expected 12/);
});

test('rhythm: one character per step, with dynamics and an optional pitch', () => {
  const p = rhythm('X.x.o...');
  assert.deepEqual(
    p.notes.map((n) => [n.time, n.velocity]),
    [
      [0, 1],
      [2, 0.78],
      [4, 0.42],
    ],
  );
  assert.deepEqual(p.notes[0].pitches, []);
  assert.deepEqual(rhythm('x.x.', { pitch: 'G2', step: 2 }).notes.map((n) => [n.time, n.pitches[0]]), [
    [0, 43],
    [4, 43],
  ]);
});

test('chords: bars share time equally, explicit lengths and % holds', () => {
  const c = chords('Am | F G | C:12 E7:4 | %');
  assert.deepEqual(
    c.map((x) => [x.symbol, x.time, x.duration]),
    [
      ['Am', 0, 16],
      ['F', 16, 8],
      ['G', 24, 8],
      ['C', 32, 12],
      ['E7', 44, 20],
    ],
  );
  assert.equal(chordsDuration(c), 64);
});

test('pad: voicings stay close to the center and move smoothly', () => {
  const p = pad(chords('C | Am | F | G'), { center: 'C4' });
  for (const n of p.notes) for (const m of n.pitches) assert.ok(m >= 50 && m <= 70, `pitch ${m} far from C4`);
  const moves = p.notes.slice(1).map((n, i) => n.pitches.reduce((s, m, k) => s + Math.abs(m - p.notes[i].pitches[k]), 0));
  for (const d of moves) assert.ok(d <= 6, `voicing jumped ${d} semitones`);
});

test('arpeggio: digits pick chord tones, - holds, . rests, the pattern restarts per chord', () => {
  const p = arpeggio(chords('C'), '0-1.2345', { step: 2, center: 'C4' });
  assert.deepEqual(
    p.notes.map((n) => [n.time, n.duration]),
    [
      [0, 4],
      [4, 2],
      [8, 2],
      [10, 2],
      [12, 2],
      [14, 2],
    ],
  );
  const m = p.notes.map((n) => n.pitches[0]);
  assert.deepEqual(new Set(m.slice(0, 3).map((x) => x % 12)), new Set([0, 4, 7]));
  assert.equal(m[3], m[0] + 12);
});

test('bassline and roots: scale degrees from the chord bass, in the register', () => {
  const b = bassline(chords('C | G/B'), 'x...x...x...x...', '1 5 8 3', { register: 'C2' });
  assert.deepEqual(pitches(b).flat(), [36, 43, 48, 40, 35, 50, 47, 47]);
  const r = roots(chords('Am | Am | E'), { register: 'C2', fifth: true });
  assert.deepEqual(
    r.notes.map((n) => [n.time, n.duration, ...n.pitches]),
    [
      [0, 32, 33, 40],
      [32, 16, 40, 47],
    ],
  );
});

test('strum: chords on the rhythm, strummed string by string', () => {
  const s = strum(chords('G'), 'x.x-', { size: 4, spread: 0.02 });
  assert.equal(s.notes.length, 8);
  assert.equal(s.notes[1].duration, 2);
  assert.equal(s.notes[0].pitches.length, 4);
  assert.equal(s.notes[0].strum, 0.02);
});

test('transforms return new parts and never modify their input', () => {
  const a = melody('C4:8 E4:8 |');
  const before = JSON.stringify(a);
  assert.equal(sequence(a, 'G4:16 |').duration, 32);
  assert.equal(sequence(a, rest(2)).duration, 48);
  assert.equal(repeat(a, 3).notes.length, 6);
  assert.equal(stack(a, melody('C3:16 |'), rest(2)).duration, 32);
  assert.deepEqual(pitches(transpose(a, 12)), [[72], [76]]);
  assert.deepEqual(pitches(mapPitch(a, (m) => m - 1)), [[59], [63]]);
  assert.deepEqual(scaleVelocity(a, 2).notes.map((n) => n.velocity), [1, 1]);
  assert.deepEqual(slice(a, 4, 12).notes.map((n) => [n.time, n.duration]), [
    [4, 4],
  ]);
  assert.equal(JSON.stringify(a), before);
});

test('pedal: notes ring until the next change, or until the same key is struck again', () => {
  const p = melody('C4:4 E4 G4 C4 | E4:8 G4:8 |');
  const byBar = pedal(p, 16);
  assert.deepEqual(
    byBar.notes.map((n) => [n.time, n.duration]),
    [
      [0, 12],
      [4, 12],
      [8, 8],
      [12, 4],
      [16, 16],
      [24, 8],
    ],
  );
  const byChord = pedal(p, chords('C | G'));
  assert.deepEqual(byChord.notes.map((n) => n.duration), byBar.notes.map((n) => n.duration));
  assert.deepEqual(pedal(p, [4, 16]).notes.map((n) => n.duration), [4, 12, 8, 4, 16, 8]);
});
