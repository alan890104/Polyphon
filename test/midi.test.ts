import assert from 'node:assert/strict';
import { test } from 'node:test';
import { songDuration, songFromMidi, type Note, type Part } from 'polyphon';

/** Build a format-1 MIDI file: each track is a list of [delta ticks, ...event bytes] */
function midiFile(ppq: number, tracks: number[][][]): Uint8Array {
  const varLen = (n: number) => {
    const out = [n & 0x7f];
    while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
    return out;
  };
  const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const chunks = tracks.map((events) => {
    const body = events.flatMap(([delta, ...bytes]) => [...varLen(delta), ...bytes]).concat([0, 0xff, 0x2f, 0]);
    return [...[0x4d, 0x54, 0x72, 0x6b], ...u32(body.length), ...body];
  });
  const header = [0x4d, 0x54, 0x68, 0x64, ...u32(6), 0, 1, 0, tracks.length, ppq >> 8, ppq & 255];
  return new Uint8Array([...header, ...chunks.flat()]);
}

const name = (s: string) => [0xff, 0x03, s.length, ...[...s].map((c) => c.charCodeAt(0))];
const notes = (song: ReturnType<typeof songFromMidi>, track: number) => (song.tracks[track].part as Part).notes;
const brief = (n: Note[]) => n.map((x) => [+x.time.toFixed(3), +x.duration.toFixed(3), ...x.pitches]);

test('tempo, meter, titles and note timing', () => {
  const file = midiFile(96, [
    [[0, ...name('Lullaby')], [0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20], [0, 0xff, 0x58, 4, 3, 2, 24, 8]], // 120 bpm, 3/4
    [
      [0, ...name('Melody')],
      [0, 0x90, 60, 100],
      [96, 0x80, 60, 0], // a quarter note: 4 steps
      [0, 0x90, 64, 127],
      [48, 0x90, 64, 0], // note-on with velocity 0 ends a note
    ],
  ]);
  const song = songFromMidi(file);
  assert.equal(song.title, 'Lullaby');
  assert.equal(song.bpm, 120);
  assert.equal(song.meter, '3/4');
  assert.equal(song.loop, false);
  assert.equal(song.tracks[0].name, 'Melody');
  assert.equal(song.tracks[0].instrument, 'piano');
  assert.deepEqual(brief(notes(song, 0)), [
    [0, 4, 60],
    [4, 2, 64],
  ]);
  assert.equal(notes(song, 0)[1].velocity, 1);
});

test('tempo changes carry over at the bars where they fall, and notes stay on the beat grid', () => {
  const file = midiFile(96, [
    [
      [0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20], // 120 bpm
      [192, 0xff, 0x51, 3, 0x0f, 0x42, 0x40], // 60 bpm after two beats
      [0, 0xff, 0x51, 3, 0x0f, 0x42, 0x40], // the same again: nothing changes
    ],
    [
      [0, 0x90, 60, 90],
      [192, 0x80, 60, 0],
      [0, 0x90, 62, 90],
      [96, 0x80, 62, 0], // one beat at half the speed
    ],
  ]);
  const song = songFromMidi(file);
  assert.deepEqual(brief(notes(song, 0)), [
    [0, 8, 60],
    [8, 4, 62],
  ]);
  assert.deepEqual(song.tempo, [{ bar: 1.5, bpm: 60 }]);
  // Two beats at 120 and one at 60, rounded up to the whole bar: one more beat at 60
  assert.deepEqual(songDuration(song), { intro: 0, loop: 1 + 1 + 1 });
});

test('the sustain pedal holds notes until it is released, or until the key is struck again', () => {
  const file = midiFile(96, [
    [
      [0, 0xb0, 64, 127],
      [0, 0x90, 48, 80],
      [24, 0x80, 48, 0],
      [0, 0x90, 52, 80],
      [24, 0x80, 52, 0],
      [0, 0x90, 48, 80], // C3 again while held: the first C3 ends here
      [24, 0x80, 48, 0],
      [48, 0xb0, 64, 0], // pedal up at tick 120
    ],
  ]);
  assert.deepEqual(brief(notes(songFromMidi(file), 0)), [
    [0, 2, 48],
    [1, 4, 52],
    [2, 3, 48],
  ]);
});

test('General MIDI programs pick instruments; channel 10 is the drum kit; volume and pan carry over', () => {
  const file = midiFile(96, [
    [
      [0, 0xc0, 40], // violin
      [0, 0xb0, 7, 50],
      [0, 0xb0, 10, 127],
      [0, 0x90, 67, 90],
      [96, 0x80, 67, 0],
      [0, 0x99, 36, 100], // kick
      [0, 0x99, 42, 80], // closed hi-hat
      [24, 0x89, 36, 0],
      [0, 0x89, 42, 0],
    ],
  ]);
  const song = songFromMidi(file, { title: 'Mix' });
  assert.equal(song.title, 'Mix');
  assert.deepEqual(
    song.tracks.map((t) => [t.instrument, t.name]),
    [
      ['violin', 'Strings'],
      ['kick', 'Kick'],
      ['hat', 'Hi-hat'],
    ],
  );
  assert.equal(song.tracks[0].gain, 0.5);
  assert.ok(Math.abs(song.tracks[0].pan! - 63 / 64) < 1e-9);
  assert.deepEqual(notes(song, 1)[0].pitches, []);
  assert.ok(song.tracks.every((t) => t.repeat === false && (t.part as Part).duration === 5));
});

test('files that are not MIDI, or have no notes, fail clearly', () => {
  assert.throws(() => songFromMidi(new Uint8Array([1, 2, 3, 4])), /Not a MIDI file/);
  assert.throws(() => songFromMidi(midiFile(96, [[[0, ...name('Empty')]]])), /no notes/);
});
