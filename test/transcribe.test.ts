import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatMelody, melody, midi, PitchTracker, transcribe } from 'polyphon';

test('formatMelody writes what melody() reads, tying notes over bar lines', () => {
  for (const [source, meter] of [
    ['C5:4 E5 G5 C6 | B5:12 r:4 |', '4/4'],
    ['r:12 G4:4 | C5:12 D5:4~ | D5 E5:12 | R | !F5:2 ?E5 D5:4> C5:8 |', '4/4'],
    ['C4+E4+G4:12 | r:4/3 D4 E4 F4:8 |', '3/4'],
  ] as const) {
    assert.equal(formatMelody(melody(source, meter), meter), source);
  }
  // A note across a bar line is tied over it; a whole bar of rest is R; the key decides sharps or flats
  assert.equal(formatMelody({ notes: [{ time: 12, duration: 8, pitches: [70], velocity: 0.78 }], duration: 48 }, 16, 'F major'), 'r:12 Bb4:4~ | Bb4 r:12 | R |');
  assert.equal(formatMelody({ notes: [{ time: 0, duration: 4, pitches: [70], velocity: 0.78 }], duration: 4 }, 16, 'B major'), 'A#4:4');
  assert.throws(() => formatMelody(melody('C4:8', 16), 16, 'H major'), /Unrecognized key/);
});

/** A note as a person sings it: seconds on the recording's clock; `dip` runs on from the note before, dipping instead of stopping */
interface Sung {
  pitch: number;
  start: number;
  end: number;
  dip?: boolean;
}

/** A synthetic voice: six harmonics, vibrato, sitting sharp and drifting flat, over a little noise and the metronome leaking in */
function sing(notes: Sung[], { rate, length, clicks }: { rate: number; length: number; clicks: number[] }): Float32Array {
  const out = new Float32Array(Math.ceil(length * rate));
  let seed = 7;
  const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / rate;
    const k = notes.findIndex((n) => t >= n.start && t < n.end);
    if (k >= 0) {
      const { pitch, start, end } = notes[k];
      const joined = notes[k + 1]?.dip;
      const attack = Math.min(1, Math.max(notes[k].dip ? 0.2 : 0, (t - start) / 0.03));
      const release = Math.min(1, Math.max(joined ? 0.2 : 0, (end - t) / 0.04));
      const cents = 35 - (40 * t) / length + 25 * Math.sin(2 * Math.PI * 5.5 * t);
      phase += (2 * Math.PI * 440 * 2 ** ((pitch - 69 + cents / 100) / 12)) / rate;
      let voice = 0;
      for (let h = 1; h <= 6; h++) voice += Math.sin(h * phase) / h;
      out[i] = 0.25 * Math.min(attack, release) * voice;
    }
    out[i] += 0.002 * noise();
  }
  for (const click of clicks) {
    for (let i = Math.round(click * rate), j = 0; j < 0.006 * rate && i + j < out.length; j++) out[i + j] += 0.2 * Math.exp(-j / (0.0015 * rate)) * noise();
  }
  return out;
}

test('transcribe writes a hummed melody on the beat grid: pickup, rests, repeated notes and a voice off pitch', () => {
  const bpm = 90;
  const beat = 60 / bpm;
  const step = beat / 4;
  // The clicks heard 0.15 s after they are scheduled; the singer a further 40 ms behind, with a little unsteadiness
  const latency = 0.15;
  const bar1 = 4 * beat;
  const jitter = [0.02, -0.015, 0.01, -0.025, 0.005, 0.015, -0.01, 0.02, -0.02, 0.01, 0, -0.005, 0.025, -0.015, 0.01, 0];
  const written = 'r:12 G4:4 | C5 C5 D5:2 E5 F5:4 | E5:6 D5:2 C5:8 | r:4 E5:2 E5 G5:4 A5 | G5:12 r:4 |';
  const part = melody(written);
  const sung: Sung[] = part.notes.map((n, i) => {
    const start = latency + 0.04 + n.time * step + jitter[i];
    // Sung on "da": most notes let go a little early; the repeated eighths run on with a dip in the voice; the last is held
    const dip = i === 10;
    const held = i === part.notes.length - 1 || i === 9 ? 1 : 0.85;
    return { pitch: n.pitches[0], start, end: start + n.duration * step * held, dip };
  });
  sung[9].end = sung[10].start;
  const rate = 48000;
  const clicks = Array.from({ length: 24 }, (_, i) => latency + i * beat);
  const audio = sing(sung, { rate, length: 24 * beat, clicks });
  const tracker = new PitchTracker(rate);
  for (let i = 0; i < audio.length; i += 2048) tracker.push(audio.subarray(i, i + 2048));
  const result = transcribe(tracker.frames, { bpm, start: bar1 + latency });
  assert.equal(result.melody, written);
  assert.equal(result.key, 'C major');
  assert.ok(result.tuning > 0 && result.tuning < 35, `tuning ${result.tuning}`);
});

test('without a click, the tempo comes from the notes; a note struck again without a break is two', () => {
  // An instrument rather than a voice: each note struck, decaying, cut off by the next (repeated notes included)
  const bpm = 97;
  const step = 15 / bpm;
  const written = 'G4:4 G4:3 A4 B4:2 B4:4 | D5:8 C5:4 B4 | A4:2 A4 G4:4 A4:2 B4 A4:4 | G4:16 |';
  const part = melody(written);
  const rate = 44100;
  const audio = new Float32Array(Math.ceil((part.duration * step + 0.5) * rate));
  part.notes.forEach((note, i) => {
    const start = Math.round((0.3 + note.time * step) * rate);
    const end = i + 1 < part.notes.length ? Math.round((0.3 + part.notes[i + 1].time * step) * rate) : start + Math.round(note.duration * step * rate);
    const f = 440 * 2 ** ((note.pitches[0] - 69) / 12);
    for (let j = start; j < end; j++) {
      const t = (j - start) / rate;
      const envelope = Math.min(1, t / 0.005) * Math.exp(-t / 0.5);
      audio[j] = 0.3 * envelope * (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t));
    }
  });
  const tracker = new PitchTracker(rate);
  tracker.push(audio);
  const result = transcribe(tracker.frames);
  assert.ok(Math.abs(result.bpm - bpm) < 0.5, `bpm ${result.bpm}`);
  assert.equal(result.melody, written);
  assert.equal(result.key, 'G major');
});

test('the pitch tracker follows a voice across its range and ignores silence', () => {
  const rate = 44100;
  for (const name of ['A2', 'E3', 'C4', 'G5', 'C6']) {
    const f = 440 * 2 ** ((midi(name) - 69) / 12);
    const tone = Float32Array.from({ length: rate / 2 }, (_, i) => 0.3 * Math.sin((2 * Math.PI * f * i) / rate) + 0.1 * Math.sin((4 * Math.PI * f * i) / rate));
    const frames = new PitchTracker(rate).push(tone).filter((frame) => frame.pitch !== null);
    assert.ok(frames.length > 40, name);
    assert.ok(frames.every((frame) => Math.abs(frame.pitch! - midi(name)) < 0.1), name);
  }
  assert.ok(new PitchTracker(rate).push(new Float32Array(rate / 2)).every((frame) => frame.pitch === null));
});
