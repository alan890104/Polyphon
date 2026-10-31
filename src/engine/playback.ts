// A song being played (one playback). Notes are scheduled ahead of time in small windows (call schedule() regularly, as the Jukebox does),
// so timing stays sample-accurate while nothing is computed during playback except starting buffers and voices.

import { getInstrument } from '../instruments/registry.ts';
import { playNote } from '../instruments/play.ts';
import { stepsPerBar } from '../notation/part.ts';
import { DEFAULT_REVERB, trackName, type Song, type Track } from '../song.ts';
import { pump, sweep } from './automation.ts';
import { compileSection, type CompiledSection, type ScheduledNote } from './compile.ts';
import { createMixer, type Strip } from './mixer.ts';

export interface PlaybackOptions {
  /** When to start, in context seconds (default: 80 ms from now) */
  at?: number;
  /** Start this many seconds into the song (default 0) */
  from?: number;
  /** Fade in over this many seconds (default 0) */
  fadeIn?: number;
  /** How many times the body plays before the song ends (default: once if `song.loop` is false, otherwise forever) */
  loops?: number;
}

/** One track of a playing song, for mixers and meters */
export interface PlaybackTrack {
  readonly name: string;
  readonly instrument: string;
  readonly section: 'intro' | 'loop';
  /** The track's signal after its level, filters and ducking, before pan and effects (connect an AnalyserNode here for a meter) */
  readonly output: AudioNode;
  muted: boolean;
}

/** Where a playback is in its song */
export interface SongPosition {
  /** Seconds since the start of the song */
  seconds: number;
  section: 'intro' | 'loop';
  /** Bar within the section, from 1 */
  bar: number;
  /** How many passes of the body have completed */
  loop: number;
}

const INTRO = 0;
const BODY = 1;

export class Playback {
  readonly song: Song;
  readonly context: BaseAudioContext;
  /** The song's output node */
  readonly output: GainNode;
  readonly tracks: readonly PlaybackTrack[];
  /** Seconds */
  readonly introDuration: number;
  /** Seconds for one pass of the body */
  readonly loopDuration: number;
  /** Seconds from start to end (Infinity when the body loops forever) */
  readonly duration: number;
  /** Context time the song started (or would have started, when playing from a later point) */
  readonly startTime: number;
  /** Resolves when a song with an end reaches it (never resolves if stopped first) */
  readonly finished: Promise<void>;

  private readonly sections: [CompiledSection, CompiledSection];
  private readonly strips: [Strip[], Strip[]];
  private readonly step: number;
  private readonly loops: number;
  private sec = INTRO;
  private idx = 0;
  /** Context time where the current section starts */
  private secStart: number;
  /** Completed passes of the body */
  private passes = 0;
  private state: 'playing' | 'ended' | 'stopped' = 'playing';
  private resolveFinished!: () => void;

  constructor(context: BaseAudioContext, destination: AudioNode, song: Song, options: PlaybackOptions = {}) {
    this.context = context;
    this.song = song;
    const meter = song.meter ?? 16;
    this.step = 60 / song.bpm / 4;
    this.loops = Math.max(1, options.loops ?? (song.loop === false ? 1 : Infinity));
    this.sections = [song.intro?.length ? compileSection(song.intro, meter) : { duration: 0, notes: [], ducks: [] }, compileSection(song.tracks, meter)];
    this.introDuration = this.sections[INTRO].duration * this.step;
    this.loopDuration = this.sections[BODY].duration * this.step;
    this.duration = this.introDuration + this.loops * this.loopDuration;
    this.finished = new Promise((resolve) => (this.resolveFinished = resolve));

    const mixer = createMixer(context, song, this.step, destination);
    this.output = mixer.output;
    this.strips = mixer.strips;
    this.tracks = [...trackHandles(song.intro ?? [], mixer.strips[INTRO], 'intro'), ...trackHandles(song.tracks, mixer.strips[BODY], 'loop')];

    const at = options.at ?? context.currentTime + 0.08;
    const fadeIn = options.fadeIn ?? 0;
    this.output.gain.setValueAtTime(fadeIn > 0 ? 0 : 1, context.currentTime);
    if (fadeIn > 0) {
      this.output.gain.setValueAtTime(0, at);
      this.output.gain.linearRampToValueAtTime(1, at + fadeIn);
    }
    const from = Math.min(Math.max(0, options.from ?? 0), this.duration - this.step);
    this.secStart = at;
    if (from > 0) this.seek(from / this.step, at);
    else this.sweep(0);
    this.startTime = at - from;
  }

  /** Seconds per sixteenth-note step */
  get stepDuration(): number {
    return this.step;
  }

  /** Still producing notes (not stopped, not past its end) */
  get playing(): boolean {
    return this.state === 'playing';
  }

  /** Schedule every note that starts before `until` (context seconds). Call this regularly, a little ahead of the clock. */
  schedule(until: number): void {
    if (this.state !== 'playing') return;
    for (let guard = 0; guard < 64; guard++) {
      const sec = this.sections[this.sec];
      while (this.idx < sec.notes.length) {
        const n = sec.notes[this.idx];
        const at = this.timeOf(n.time);
        if (at >= until) return;
        this.fire(this.sec, n, at);
        this.duckUnder(n.track, at);
        this.idx++;
      }
      const end = this.secStart + sec.duration * this.step;
      if (end >= until) return;
      if (this.sec === BODY) {
        if (this.passes + 1 >= this.loops) {
          this.end(end);
          return;
        }
        this.passes++;
      }
      // Next section: after the intro comes the body; the body repeats
      const again = this.sec === BODY;
      this.secStart = end;
      this.sec = BODY;
      this.idx = 0;
      this.sweep(0, again);
    }
  }

  /** Where the song is at a context time (default: now) */
  position(time = this.context.currentTime): SongPosition {
    const sectionStart = this.sec === INTRO ? 0 : this.introDuration + this.passes * this.loopDuration;
    const seconds = Math.min(this.duration, Math.max(0, sectionStart + time - this.secStart));
    const barSeconds = stepsPerBar(this.song.meter) * this.step;
    if (seconds < this.introDuration) return { seconds, section: 'intro', bar: Math.floor(seconds / barSeconds) + 1, loop: 0 };
    const inBody = seconds - this.introDuration;
    const loop = Math.min(Math.floor(inBody / this.loopDuration), this.loops - 1);
    return { seconds, section: 'loop', bar: Math.floor((inBody - loop * this.loopDuration) / barSeconds) + 1, loop };
  }

  /** Fade out and release */
  stop(fade = 0.8): void {
    if (this.state === 'stopped') return;
    this.state = 'stopped';
    const now = this.context.currentTime;
    const g = this.output.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + fade);
    onClock(this.context, now + fade + 0.3, () => this.output.disconnect());
  }

  /** Context time of a step in the current section, with swing applied to on-grid steps */
  private timeOf(step: number): number {
    const { swing, swing16 } = this.song;
    let s = step;
    const i = Math.floor(step + 1e-6);
    if (Math.abs(step - i) < 1e-6) {
      if (swing && i % 4 === 2) s += swing * 2;
      else if (swing16 && i % 2 === 1) s += swing16;
    }
    return this.secStart + s * this.step;
  }

  private fire(section: number, n: ScheduledNote, at: number): void {
    const track = this.trackOf(section, n.track);
    const def = getInstrument(track.instrument);
    const drum = def.kind === 'sample' && (def.variants ?? 0) > 0;
    const humanize = track.humanize ?? (drum ? 0.003 : 0.008);
    const t = Math.max(this.context.currentTime + 0.005, at + (Math.random() - 0.5) * humanize);
    const vel = Math.min(1, n.velocity * (1 + (Math.random() - 0.5) * 0.1));
    const dur = n.duration * this.step;
    const transpose = track.transpose ?? 0;
    const pitches = n.pitches.length ? n.pitches : [0];
    pitches.forEach((m, k) => {
      playNote(track.instrument, {
        ctx: this.context,
        out: this.strips[section][n.track].input,
        t: t + (n.strum ? k * n.strum : 0),
        dur,
        m: m ? m + transpose : 0,
        vel,
        bends: n.bends?.map(([s, bm]) => [s * this.step, bm + transpose] as [number, number]),
        params: track.params,
      });
    });
  }

  /** Jump to a step counted from the start of the song; sustained notes already sounding at that point are picked up */
  private seek(step: number, at: number): void {
    const introSteps = this.sections[INTRO].duration;
    let offset = step;
    if (step >= introSteps) {
      const bodySteps = this.sections[BODY].duration;
      this.passes = Math.floor((step - introSteps) / bodySteps);
      offset = step - introSteps - this.passes * bodySteps;
      this.sec = BODY;
    }
    this.secStart = at - offset * this.step;
    const { notes, ducks } = this.sections[this.sec];
    /** The last hit of each track that others duck under */
    const hits = new Map<number, number>();
    while (this.idx < notes.length && notes[this.idx].time < offset - 1e-9) {
      const n = notes[this.idx++];
      if (ducks[n.track].length) hits.set(n.track, n.time);
      const left = n.time + n.duration - offset;
      if (left > 0.5 && sustains(this.trackOf(this.sec, n.track))) {
        const into = offset - n.time;
        const bends = n.bends?.filter(([s]) => s > into).map(([s, m]) => [s - into, m] as [number, number]);
        this.fire(this.sec, { ...n, time: offset, duration: left, bends }, at);
      }
    }
    // Pick up the pumping and the filter sweeps where they would be by now
    for (const [track, time] of hits) this.duckUnder(track, this.timeOf(time), at);
    this.sweep(offset);
  }

  /** A track's hit at `hit` (context seconds): the tracks that duck under it pump (picked up at `from` when the hit is past) */
  private duckUnder(track: number, hit: number, from = hit): void {
    for (const k of this.sections[this.sec].ducks[track]) pump(this.strips[this.sec][k].pump!, hit, from);
  }

  /** A pass of the current section begins (`from` steps in; `again` when it follows a pass of the same section): send its filters along their sweeps */
  private sweep(from: number, again = false): void {
    const { duration } = this.sections[this.sec];
    for (const strip of this.strips[this.sec]) for (const s of strip.sweeps) sweep(s.cutoff, s.points, this.secStart, from, duration, this.step, again);
  }

  private trackOf(section: number, index: number): Track {
    return section === INTRO ? this.song.intro![index] : this.song.tracks[index];
  }

  /** A song with an end has played its last section: release after the reverb tail */
  private end(at: number): void {
    this.state = 'ended';
    onClock(this.context, at, () => this.resolveFinished());
    onClock(this.context, at + (this.song.reverb ?? DEFAULT_REVERB).size + 1.5, () => this.output.disconnect());
  }
}

/**
 * Run `fn` when the context's own clock reaches `time`. A wall-clock timer would drift from the audio: an offline render runs
 * faster or slower than real time, and a suspended context does not advance at all.
 */
function onClock(ctx: BaseAudioContext, time: number, fn: () => void): void {
  const tick = ctx.createConstantSource();
  const silent = ctx.createGain();
  silent.gain.value = 0;
  tick.connect(silent).connect(ctx.destination);
  tick.onended = () => {
    tick.disconnect();
    silent.disconnect();
    fn();
  };
  tick.start(ctx.currentTime);
  tick.stop(Math.max(ctx.currentTime, time));
}

/** Instruments whose notes can be picked up mid-way when seeking (pads, bowed strings, ambience), as opposed to struck ones */
function sustains(track: Track): boolean {
  const def = getInstrument(track.instrument);
  return def.kind === 'live' || !!def.bow || !!def.loop;
}

function trackHandles(tracks: Track[], strips: Strip[], section: 'intro' | 'loop'): PlaybackTrack[] {
  return tracks.map((track, i) => {
    const { input, output } = strips[i];
    let muted = false;
    return {
      name: trackName(track),
      instrument: track.instrument,
      section,
      output,
      get muted() {
        return muted;
      },
      set muted(value: boolean) {
        muted = value;
        input.gain.setTargetAtTime(value ? 0 : (track.gain ?? 1), input.context.currentTime, 0.015);
      },
    };
  });
}
