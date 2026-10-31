// Melodies by ear: a pitch tracker for one voice (singing, humming, whistling) and a transcriber that writes what it heard as notes
// on the beat grid. Clean singing needs no trained model: a voice's pitch shows in the sound's own periodicity (the YIN method), and
// a metronome fixes where the beats are, so the rhythm comes down to rounding to the grid.

import { formatMelody } from './notation/format.ts';
import { stepsPerBar, VELOCITY, type Meter, type Note, type Part } from './notation/part.ts';

/** The pitch heard over a few hundredths of a second */
export interface PitchFrame {
  /** Seconds from the first sample pushed, at the middle of the frame */
  time: number;
  /** MIDI pitch, fractional (69.2 is A4 a little sharp); null when no steady pitch was heard */
  pitch: number | null;
  /** How periodic the sound is, 0-1 (a held vowel is above 0.9, breath and clicks well below) */
  clarity: number;
  /** Loudness in dB (0 is full scale) */
  level: number;
}

/** Voices are tracked at about this rate: fundamentals up to C6 with room to spare, at a third of the work of 48 kHz */
const TRACKING_RATE = 16000;
/** The pitch range tracked, in Hz: a low bass hum to a high whistle */
const LOWEST = 55;
const HIGHEST = 1400;
/** YIN's threshold on the normalized difference: the first dip under it is the period */
const THRESHOLD = 0.15;
/** Frames less periodic than this have no pitch */
const MIN_CLARITY = 0.6;

/**
 * Follows the pitch of one voice through audio pushed to it in pieces of any size, as a microphone delivers them, every 10 ms.
 *
 * @example
 * const tracker = new PitchTracker(context.sampleRate);
 * worklet.port.onmessage = ({ data }) => draw(tracker.push(data));
 */
export class PitchTracker {
  /** Every frame so far */
  readonly frames: PitchFrame[] = [];
  /** Input samples averaged into each tracked one */
  private readonly factor: number;
  private readonly rate: number;
  /** Samples in YIN's integration window, the longest period, and between frames */
  private readonly window: number;
  private readonly maxLag: number;
  private readonly minLag: number;
  private readonly hop: number;
  /** Tracked samples not yet passed by the frames, the first of them sample number `base` */
  private buffer = new Float32Array(4096);
  private length = 0;
  private base = 0;
  /** The first sample of the next frame */
  private next = 0;
  /** The input samples being averaged into the next tracked one */
  private sum = 0;
  private count = 0;
  private readonly difference: Float64Array;

  constructor(sampleRate: number) {
    this.factor = Math.max(1, Math.floor(sampleRate / TRACKING_RATE));
    this.rate = sampleRate / this.factor;
    this.window = Math.round(0.032 * this.rate);
    this.maxLag = Math.ceil(this.rate / LOWEST);
    this.minLag = Math.floor(this.rate / HIGHEST);
    this.hop = Math.round(0.01 * this.rate);
    this.difference = new Float64Array(this.maxLag + 1);
  }

  /** Add samples; returns the frames they completed */
  push(samples: Float32Array): PitchFrame[] {
    for (const sample of samples) {
      this.sum += sample;
      if (++this.count < this.factor) continue;
      if (this.length === this.buffer.length) {
        const grown = new Float32Array(this.buffer.length * 2);
        grown.set(this.buffer);
        this.buffer = grown;
      }
      this.buffer[this.length++] = this.sum / this.factor;
      this.sum = this.count = 0;
    }
    const added: PitchFrame[] = [];
    const span = this.window + this.maxLag;
    while (this.next + span <= this.base + this.length) {
      const start = this.next - this.base;
      added.push(this.analyse(this.buffer.subarray(start, start + span), (this.next + this.window / 2) / this.rate));
      this.next += this.hop;
    }
    const passed = this.next - this.base;
    this.buffer.copyWithin(0, passed, this.length);
    this.length -= passed;
    this.base = this.next;
    this.frames.push(...added);
    return added;
  }

  private analyse(x: Float32Array, time: number): PitchFrame {
    const { window, minLag, maxLag, difference: d } = this;
    let energy = 0;
    for (let j = 0; j < window; j++) energy += x[j] * x[j];
    const level = 10 * Math.log10(energy / window + 1e-12);
    // The difference between the signal and itself delayed by each lag, normalized by its running mean
    d[0] = 1;
    let running = 0;
    for (let lag = 1; lag <= maxLag; lag++) {
      let sum = 0;
      for (let j = 0; j < window; j++) {
        const delta = x[j] - x[j + lag];
        sum += delta * delta;
      }
      running += sum;
      d[lag] = running > 0 ? (sum * lag) / running : 1;
    }
    // The first dip under the threshold (at its lowest point), else the deepest dip there is
    let lag = -1;
    for (let l = minLag; l < maxLag; l++) {
      if (d[l] >= THRESHOLD) continue;
      while (l + 1 < maxLag && d[l + 1] < d[l]) l++;
      lag = l;
      break;
    }
    if (lag < 0) {
      lag = minLag;
      for (let l = minLag + 1; l < maxLag; l++) if (d[l] < d[lag]) lag = l;
    }
    const clarity = Math.min(1, Math.max(0, 1 - d[lag]));
    if (clarity < MIN_CLARITY) return { time, pitch: null, clarity, level };
    // A parabola through the dip and its neighbours finds the period between samples
    const [a, b, c] = [d[lag - 1], d[lag], d[lag + 1]];
    const bend = a - 2 * b + c;
    const period = lag + (bend > 0 ? (a - c) / (2 * bend) : 0);
    return { time, pitch: 69 + 12 * Math.log2(this.rate / period / 440), clarity, level };
  }
}

export interface TranscribeOptions {
  /** The tempo the melody was sung at: the metronome's. Left out, it is found from the notes themselves (singing without a click). */
  bpm?: number;
  /** Time signature (default '4/4') */
  meter?: Meter;
  /** When a bar starts, in seconds on the frames' clock: the metronome's first downbeat (found with the tempo when that is left out) */
  start?: number;
  /** The shortest note written, in steps: 1 for sixteenths (default), 2 for eighths */
  grid?: number;
}

export interface Transcription {
  /** The notes on the beat grid, from the start of the first bar sung in */
  part: Part;
  /** The part written as a melody string, spelled in its key */
  melody: string;
  /** The tempo: as given, or as found */
  bpm: number;
  /** Where the part's first step falls, in seconds on the frames' clock (to line the notes up with what was heard) */
  start: number;
  /** The key the notes suggest, such as 'G major' or 'E minor' (empty when nothing was heard) */
  key: string;
  /** How far the singing sat from concert pitch, in cents (+20: a little sharp). The notes are corrected for it. */
  tuning: number;
}

/** A stretch of steady pitch, before it is put on the grid */
interface Heard {
  /** Seconds on the frames' clock */
  start: number;
  end: number;
  /** MIDI pitch: fractional as heard, then settled on a semitone */
  pitch: number;
  /** It runs on from the note before, the voice moving straight from one to the other without a break or a dip */
  tied: boolean;
}

/**
 * Write a sung melody as notes. The pitches are corrected for a voice that sits sharp or flat (or drifts) and rounded to the key where
 * a note falls between two. The timing is put on the grid of a metronome at `bpm` whose bars start at `start`, or of the tempo the
 * notes themselves keep; a note between two grid lines leans to the stronger beat, and runs on to the next note unless a clear rest
 * is left between them.
 *
 * @example
 * transcribe(tracker.frames, { bpm: 90, start: 2.67 }).melody; // 'r:12 G4:2 G4 | A4:4 G4 C5 B4 | ...'
 * transcribe(tracker.frames).bpm;                              // 96.8, found from the notes
 */
export function transcribe(frames: readonly PitchFrame[], options: TranscribeOptions = {}): Transcription {
  const { meter, grid = 1 } = options;
  const bar = stepsPerBar(meter);
  // A slide into a note shorter than this belongs to the note, not one of its own
  const slide = options.bpm ? Math.min(0.09, (0.6 * 15) / options.bpm) : 0.08;
  const heard = listen(frames, slide);
  if (!heard.length) return { part: { notes: [], duration: 0 }, melody: '', bpm: options.bpm ?? 0, start: options.start ?? 0, key: '', tuning: 0 };
  const { pitches, key, tuning } = tune(heard);
  // Pieces of one note heard apart (the voice wavered past the band between them) are one note again
  const sung: Heard[] = [];
  heard.forEach((h, i) => {
    const previous = sung[sung.length - 1];
    if (previous && h.tied && previous.pitch === pitches[i]) previous.end = h.end;
    else sung.push({ ...h, pitch: pitches[i] });
  });
  const { bpm, start } = options.bpm ? { bpm: options.bpm, start: options.start ?? 0 } : findTempo(sung, bar);
  const { timed, shift } = align(sung, bpm, start, grid, bar);
  // From the bar the first note falls in, which may be a bar before the first downbeat (a pickup in the count-in)
  const origin = Math.floor(timed[0].start / bar) * bar;
  const notes: Note[] = timed.map(({ start, end, index }) => ({ time: start - origin, duration: end - start, pitches: [sung[index].pitch], velocity: VELOCITY.normal }));
  const last = notes[notes.length - 1];
  const part = { notes, duration: Math.ceil((last.time + last.duration) / bar) * bar };
  return { part, melody: formatMelody(part, meter, key), bpm, start: start + ((origin + shift) * 15) / bpm, key, tuning };
}

/** Steady stretches of pitch: voiced runs, split where the pitch moves to a new note or the same note starts again */
function listen(frames: readonly PitchFrame[], slide: number): Heard[] {
  if (frames.length < 2) return [];
  const hop = frames[1].time - frames[0].time;
  const sorted = frames.flatMap((f) => (f.pitch === null ? [] : [f.level])).sort((a, b) => a - b);
  if (!sorted.length) return [];
  const loudest = sorted[Math.floor(sorted.length * 0.98)];
  // Quieter than this is the room, or the metronome leaking in, not the voice
  const floor = Math.max(loudest - 35, -70);
  const voiced = (f: PitchFrame) => f.pitch !== null && f.level >= floor;
  const heard: Heard[] = [];
  for (let i = 0; i < frames.length; ) {
    if (!voiced(frames[i])) {
      i++;
      continue;
    }
    let j = i;
    while (j < frames.length && voiced(frames[j])) j++;
    heard.push(...notesIn(frames.slice(i, j), hop, Math.round(slide / hop)));
    i = j;
  }
  return heard;
}

/** The shortest stretch of voice taken for a note, in frames */
const MIN_FRAMES = 4;

/** The notes in one unbroken run of voice; `slide` is the most frames a slide into or out of a note lasts */
function notesIn(run: readonly PitchFrame[], hop: number, slide: number): Heard[] {
  // A median of five steadies the line and removes single frames an octave out
  const pitch = run.map((_, i) => median(run.slice(Math.max(0, i - 2), i + 3).map((f) => f.pitch!)));
  const level = run.map((_, i) => mean(run.slice(Math.max(0, i - 1), i + 2).map((f) => f.level)));
  // Steady frames: the pitch is not sliding from one note to another (vibrato stays well under this)
  const steady = pitch.map((_, i) => Math.abs(pitch[Math.min(i + 1, pitch.length - 1)] - pitch[Math.max(i - 1, 0)]) / 2 < 0.3);
  const length = (s: Segment) => s.to - s.from;
  // A note's pitch is where the voice settles: its first frames may still be scooping up to it
  const at = (s: Segment) => median(pitch.slice(s.from + Math.floor(0.3 * (s.to - s.from)), s.to));
  const notes: Heard[] = [];
  // Each new start of the voice (a dip and a rise, or a sudden attack) begins a note; within one, the pitch may still move on
  for (const [first, last] of articulations(run, level, Math.max(MIN_FRAMES, slide))) {
    // Segments of steady frames within a semitone's band of their own median
    let segments: Segment[] = [];
    let from = -1;
    let members: number[] = [];
    const close = (to: number) => {
      if (from >= 0 && to - from >= MIN_FRAMES) segments.push({ from, to });
      from = -1;
      members = [];
    };
    for (let i = first; i < last; i++) {
      if (!steady[i]) {
        close(i);
        continue;
      }
      if (from >= 0 && Math.abs(pitch[i] - median(members)) > 0.6) close(i);
      if (from < 0) from = i;
      members.push(pitch[i]);
    }
    close(last);
    // A segment no longer than a slide is the voice moving between notes, unless there is nothing longer; at the start a scoop up
    // to the note, and at the end a fall from it, can last twice as long
    const longest = Math.max(0, ...segments.map(length));
    segments = segments.filter((s) => length(s) > slide || length(s) === longest);
    for (const [end, next] of [[0, 1], [segments.length - 1, segments.length - 2]]) {
      const [a, b] = [segments[end], segments[next]];
      if (a && b && length(a) <= 2 * slide && length(a) < length(b) && Math.abs(at(a) - at(b)) < 2.5) segments.splice(end, 1);
    }
    if (!segments.length && last - first >= MIN_FRAMES) segments = [{ from: first, to: last }];
    // Neighbours at the same pitch are one note: a vibrato wider than the band can split one
    for (let k = segments.length - 1; k > 0; k--) {
      if (Math.abs(at(segments[k - 1]) - at(segments[k])) < 0.5) {
        segments[k - 1].to = segments[k].to;
        segments.splice(k, 1);
      }
    }
    // Notes change halfway through the slide between them; the first starts with the voice and the last ends with it
    segments.forEach((segment, k) => {
      const start = k === 0 ? first : Math.round((segments[k - 1].to + segment.from) / 2);
      const end = k === segments.length - 1 ? last : Math.round((segment.to + segments[k + 1].from) / 2);
      notes.push({ start: run[start].time - hop / 2, end: run[end - 1].time + hop / 2, pitch: at(segment), tied: k > 0 });
    });
  }
  return notes;
}

/** Frames `from` up to `to` */
interface Segment {
  from: number;
  to: number;
}

/**
 * Where the same pitch starts again without a break: the voice dips by 6 dB and comes back ("da da"), or the sound jumps up by
 * 3 dB within 40 ms and stays up (a new attack, the way an instrument strikes a repeated note; a voice swells far more slowly).
 * `level` is smoothed; the attack is read from the frames' own levels, as smoothing blunts it.
 */
function articulations(run: readonly PitchFrame[], level: readonly number[], shortest: number): [number, number][] {
  const parts: [number, number][] = [];
  let start = 0;
  for (let i = shortest; i < run.length - shortest; i++) {
    const before = Math.max(...level.slice(Math.max(start, i - 12), i));
    const after = Math.max(...level.slice(i + 1, i + 13));
    const dip = level[i] <= level[i - 1] && level[i] <= level[i + 1] && level[i] < before - 6 && level[i] < after - 6;
    const raw = run[i].level;
    const ahead = run.slice(i + 1, i + 9).map((f) => f.level);
    const attack = raw <= run[i - 1].level && Math.max(...ahead.slice(0, 4)) - raw >= 3 && mean(ahead) - raw >= 2;
    if (!dip && !attack) continue;
    parts.push([start, i]);
    start = dip ? i + 1 : i;
    i += shortest - 1;
  }
  parts.push([start, run.length]);
  return parts;
}

const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const MAJOR_TONICS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_TONICS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];
/** The notes of each mode, relative to the tonic (minor with both its sixths and sevenths) */
const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 9, 10, 11] };

/**
 * Settle each note on a semitone. The voice's offset from concert pitch is measured around each note (over its neighbours, so a
 * voice that drifts flat is followed), and a note that still falls between two semitones takes the one in the key.
 */
function tune(heard: readonly Heard[]): { pitches: number[]; key: string; tuning: number } {
  const offsets = heard.map((_, i) => {
    let [x, y] = [0, 0];
    for (let j = Math.max(0, i - 4); j <= Math.min(heard.length - 1, i + 4); j++) {
      const weight = heard[j].end - heard[j].start;
      const angle = 2 * Math.PI * (heard[j].pitch - Math.round(heard[j].pitch));
      x += weight * Math.cos(angle);
      y += weight * Math.sin(angle);
    }
    return Math.atan2(y, x) / (2 * Math.PI);
  });
  const corrected = heard.map((h, i) => h.pitch - offsets[i]);
  // The key whose profile best matches how long each pitch class sounds (Krumhansl and Kessler's)
  const weights = new Array<number>(12).fill(0);
  corrected.forEach((p, i) => (weights[((Math.round(p) % 12) + 12) % 12] += heard[i].end - heard[i].start));
  let best = { score: -Infinity, tonic: 0, mode: 'major' as keyof typeof SCALES };
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const [mode, profile] of [['major', MAJOR], ['minor', MINOR]] as const) {
      const score = correlation(weights, profile.map((_, k) => profile[(k - tonic + 12) % 12]));
      if (score > best.score) best = { score, tonic, mode };
    }
  }
  const inKey = (p: number) => SCALES[best.mode].includes((((p - best.tonic) % 12) + 12) % 12);
  const pitches = corrected.map((p) => {
    const [low, high] = [Math.floor(p), Math.ceil(p)];
    const between = Math.abs(p - Math.round(p)) > 0.3;
    if (between && inKey(low) !== inKey(high)) return inKey(low) ? low : high;
    return Math.round(p);
  });
  const key = `${(best.mode === 'major' ? MAJOR_TONICS : MINOR_TONICS)[best.tonic]} ${best.mode}`;
  return { pitches, key, tuning: Math.round(100 * median(offsets)) };
}

/**
 * The tempo and a downbeat of notes sung without a click. The tempo is the sixteenth-note grid (between 70 and 140 beats a minute)
 * the starts fit best, favouring grids on which the notes last whole eighths; the downbeat is the grid line that puts the longest
 * notes on the strongest beats.
 */
function findTempo(heard: readonly Heard[], bar: number): { bpm: number; start: number } {
  const onsets = heard.map((h) => h.start);
  /** How closely the starts sit on a grid `step` seconds apart (0-1), and where its lines fall */
  const fit = (step: number) => {
    let [x, y] = [0, 0];
    for (const t of onsets) {
      x += Math.cos((2 * Math.PI * t) / step);
      y += Math.sin((2 * Math.PI * t) / step);
    }
    return { closeness: Math.hypot(x, y) / onsets.length, phase: ((Math.atan2(y, x) / (2 * Math.PI)) * step + step) % step };
  };
  const evens = (step: number) => onsets.slice(1).filter((t, i) => Math.round((t - onsets[i]) / step) % 2 === 0).length / Math.max(1, onsets.length - 1);
  const score = (step: number) => fit(step).closeness + 0.25 * evens(step);
  // Coarsely across the range, then finely around the best: over a minute of singing, a tenth of a percent is a sixteenth adrift
  let best = 15 / 140;
  for (let step = best; step <= 15 / 70; step *= 1.001) if (score(step) > score(best)) best = step;
  for (let step = best / 1.001, around = best; step <= around * 1.001; step *= 1.00002) if (fit(step).closeness > fit(best).closeness) best = step;
  const { phase } = fit(best);
  // Where each note starts on the grid, and how long it lasts
  const notes = heard.map((h) => ({ at: Math.round((h.start - phase) / best), length: h.end - h.start }));
  const strength = (position: number) => (position === 0 ? 1 : position * 2 === bar ? 0.6 : position % 4 === 0 ? 0.4 : position % 2 === 0 ? 0.15 : 0);
  let downbeat = 0;
  let strongest = -Infinity;
  for (let line = 0; line < bar; line++) {
    const total = notes.reduce((sum, n) => sum + n.length * strength((((n.at - line) % bar) + bar) % bar), 0);
    if (total > strongest) [downbeat, strongest] = [line, total];
  }
  return { bpm: 15 / best, start: phase + downbeat * best };
}

/** A heard note on the grid, in steps from the first bar's downbeat */
interface Timed {
  start: number;
  end: number;
  /** Which heard note */
  index: number;
}

/** How weak a place in the beat is: a beat, an eighth off it, a sixteenth off it */
const weakness = (step: number) => [0, 0.12, 0.06, 0.12][((step % 4) + 4) % 4];

/** The grid line a start goes to: the nearer of the two around it, weighed against how weak a place each is */
function snap(position: number, grid: number): number {
  const below = Math.floor(position / grid) * grid;
  const cost = (at: number) => Math.abs(position - at) + weakness(at);
  return cost(below) <= cost(below + grid) ? below : below + grid;
}

/**
 * Put the notes on the grid. A steady lead or lag behind the beat (the singer's, or the audio hardware's) is taken out first: the
 * shift, up to a step either way, that brings the starts nearest the grid and the strongest beats. A note lasts until the next one
 * unless the silence before that is a rest worth writing.
 */
function align(heard: readonly Heard[], bpm: number, start: number, grid: number, bar: number): { timed: Timed[]; shift: number } {
  const step = 15 / bpm;
  const raw = heard.map((h) => ({ start: (h.start - start) / step, end: (h.end - start) / step }));
  const cost = (shift: number) =>
    raw.reduce((sum, n) => {
      const at = snap(n.start - shift, grid);
      return sum + Math.abs(n.start - shift - at) + weakness(at);
    }, 0.02 * raw.length * Math.abs(shift));
  let shift = 0;
  for (let s = -1; s <= 1; s += 0.02) if (cost(s) < cost(shift)) shift = s;
  const timed: Timed[] = [];
  raw.forEach(({ start: s, end: e }, index) => {
    const at = snap(s - shift, grid);
    const previous = timed[timed.length - 1];
    if (previous && at <= previous.start) {
      // Two notes on one grid line: the shorter was a slip of the voice
      if (e - s <= previous.end - previous.start) return;
      timed.pop();
    }
    timed.push({ start: at, end: e - shift, index });
  });
  const eighths = Math.max(grid, 2);
  timed.forEach((note, i) => {
    // Where a note let go ends: on the beat it was let go up to half a beat before, or else in the eighth it was let go in (voices
    // let go a little early, and fade a little late)
    const beat = Math.ceil(note.end / 4) * 4;
    const released = Math.max(note.start + grid, beat - note.end <= 2 ? beat : Math.ceil((note.end - 0.6) / eighths) * eighths);
    const next = timed[i + 1]?.start;
    if (next === undefined) {
      // The last note rings on to the bar line if it gets within three sixteenths of it
      const barline = Math.ceil(note.end / bar) * bar;
      note.end = barline - note.end <= 3 ? barline : released;
      return;
    }
    // A rest is written for a silence of half a beat and a third of a second, as long as a beat or two fifths of the time from
    // one note to the next
    const silence = next - note.end;
    const rest = silence >= 2 && silence * step >= 1 / 3 && (silence >= 4 || silence >= 0.4 * (next - note.start));
    note.end = rest ? Math.min(released, next) : next;
  });
  return { timed, shift };
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function correlation(a: readonly number[], b: readonly number[]): number {
  const [ma, mb] = [mean(a), mean(b)];
  let [ab, aa, bb] = [0, 0, 0];
  for (let i = 0; i < a.length; i++) {
    ab += (a[i] - ma) * (b[i] - mb);
    aa += (a[i] - ma) ** 2;
    bb += (b[i] - mb) ** 2;
  }
  return aa && bb ? ab / Math.sqrt(aa * bb) : 0;
}
