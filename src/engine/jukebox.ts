// The Jukebox: the one object a game needs. It owns the clock, crossfades between songs, prepares samples ahead of time,
// and handles the browser's audio unlock. One song plays at a time; jingles can be layered on top.

import type { Song } from '../song.ts';
import { createOutputStage } from './output.ts';
import { Performance } from './performance.ts';
import { prepareSong, prepareSongSync } from './prepare.ts';

/** A song, or a function that loads one (`() => import('./songs/title.ts')` works: a module's default export is used) */
export type SongSource = Song | (() => Promise<Song | { default: Song }>);

export interface JukeboxOptions {
  /** Use this AudioContext (default: one is created on first use) */
  context?: AudioContext;
  /** Where the music goes (default: the speakers) */
  destination?: AudioNode;
  /** Songs that can be played by name */
  songs?: Record<string, SongSource>;
  /** 0-1 (default 1) */
  volume?: number;
}

export interface PlayOptions {
  /** Seconds to fade the previous song out (default 0.9) */
  fadeOut?: number;
  /** Seconds to fade this song in (default: 0.05 if it has an intro, otherwise 1.2) */
  fadeIn?: number;
  /** Start this many seconds into the song */
  from?: number;
  /** How many times the body plays before the song ends (default: forever, or once if `song.loop` is false) */
  loops?: number;
}

export interface DuckOptions {
  /** Seconds to reach the ducked level (default 0: instantly) */
  attack?: number;
  /** Seconds to stay there (default 0) */
  hold?: number;
  /** Seconds to come back (default 0.35) */
  release?: number;
}

export type JukeboxState = 'idle' | 'loading' | 'playing' | 'paused';

/** How far ahead notes are scheduled: a little while visible, much more in a background tab (whose timers are throttled to about once a second) */
const AHEAD = 0.25;
const AHEAD_HIDDEN = 1.6;

export class Jukebox {
  private ctx: AudioContext | null;
  private readonly destination?: AudioNode;
  private readonly songs: Record<string, SongSource>;
  private readonly loaded = new Map<SongSource, Promise<Song>>();
  private volumeNode: GainNode | null = null;
  private duckNode: GainNode | null = null;
  private volumeLevel: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  /** Incremented whenever the current song changes: a song still loading only starts if nothing replaced it */
  private token = 0;
  /** The song asked for last (it may still be loading) */
  private wanted: SongSource | null = null;
  private pending: Promise<Performance | null> | null = null;
  private song: Song | null = null;
  /** The loop count the current song was asked to play with */
  private loops: number | undefined;
  private perf: Performance | null = null;
  private pausedAt: number | null = null;
  /** Mute states to carry into the next performance of the same song (after a seek or a pause) */
  private carry = new Set<string>();
  /** Preloads queue up behind each other, so they never compete with each other for the main thread */
  private preloads: Promise<unknown> = Promise.resolve();

  constructor(options: JukeboxOptions = {}) {
    this.ctx = options.context ?? null;
    this.destination = options.destination;
    this.songs = options.songs ?? {};
    this.volumeLevel = options.volume ?? 1;
  }

  /** The audio context (created on first use; it starts on the first click, tap or key press if the browser requires one) */
  get context(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    if (!this.volumeNode) this.connect(this.ctx);
    return this.ctx;
  }

  /** The song playing, paused, or about to start (null when idle) */
  get current(): Song | null {
    return this.song;
  }

  /** The playing performance, for positions, durations and per-track mixing */
  get performance(): Performance | null {
    return this.perf;
  }

  get state(): JukeboxState {
    if (this.pausedAt !== null) return 'paused';
    if (this.pending) return 'loading';
    return this.perf?.playing ? 'playing' : 'idle';
  }

  /** Seconds into the current song */
  get position(): number {
    if (this.pausedAt !== null) return this.pausedAt;
    return this.perf ? this.perf.position().seconds : 0;
  }

  get volume(): number {
    return this.volumeLevel;
  }

  set volume(value: number) {
    this.volumeLevel = Math.min(1, Math.max(0, value));
    if (this.volumeNode && this.ctx) this.volumeNode.gain.setTargetAtTime(this.volumeLevel, this.ctx.currentTime, 0.02);
  }

  /**
   * Play a song (by name, or a song / loader), crossfading from the one before.
   * Asking for the song that is already playing does nothing; asking for a paused one resumes it.
   * Resolves with the performance once it starts, or null if another song was asked for before this one was ready.
   */
  play(song: string | SongSource, options: PlayOptions = {}): Promise<Performance | null> {
    const source = this.resolve(song);
    if (source === this.wanted) {
      if (this.pausedAt !== null) {
        this.resume();
        return Promise.resolve(this.perf);
      }
      if (this.pending) return this.pending;
      if (this.perf?.playing) return Promise.resolve(this.perf);
    }
    this.halt(options.fadeOut ?? 0.9);
    this.wanted = source;
    this.loops = options.loops;
    this.pending = this.begin(source, this.token, options);
    return this.pending;
  }

  /** Fade the music out and go silent */
  stop(fade = 0.9): void {
    this.halt(fade);
    this.wanted = null;
    this.song = null;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  /** Pause the current song (resume() continues from the same point) */
  pause(): void {
    if (!this.perf?.playing) return;
    const at = this.perf.position().seconds;
    this.carry = mutedTracks(this.perf);
    this.halt(0.12);
    this.pausedAt = at;
  }

  /** Continue a paused song */
  resume(): void {
    if (this.pausedAt === null || !this.song) return;
    const from = this.pausedAt;
    this.pausedAt = null;
    this.start(this.song, { fadeIn: 0.05, from });
  }

  /** Jump to a point in the current song (seconds) */
  seek(seconds: number): void {
    if (this.pausedAt !== null) {
      this.pausedAt = Math.max(0, seconds);
      return;
    }
    if (!this.song || !this.perf) return;
    this.carry = mutedTracks(this.perf);
    this.perf.stop(0.12);
    this.start(this.song, { fadeIn: 0.08, from: seconds });
  }

  /** Render a song's samples ahead of time, so playing it later starts without a wait */
  preload(song: string | SongSource): Promise<void> {
    const source = this.resolve(song);
    const ctx = this.context;
    const job = this.preloads.then(() => this.load(source)).then((def) => prepareSong(ctx, def));
    this.preloads = job.catch(() => undefined);
    return job;
  }

  /** Play a short song once on top of whatever is playing (victory jingles, fanfares). Its samples are rendered on the spot. */
  playOnce(song: Song): Performance {
    const ctx = this.context;
    prepareSongSync(ctx, song);
    const perf = new Performance(ctx, this.volumeNode!, song, { at: ctx.currentTime + 0.03, loops: 1 });
    perf.schedule(perf.startTime + perf.duration);
    return perf;
  }

  /**
   * Lower the music for a moment, for example under a big sound effect or a line of dialogue.
   *
   * @example
   * jukebox.duck(-10);                                        // a hit: drop 10 dB, recover over 0.35 s
   * jukebox.duck(-30, { attack: 0.12, hold: 4, release: 0.6 }); // near silence for a cutscene beat
   */
  duck(db: number, { attack = 0, hold = 0, release = 0.35 }: DuckOptions = {}): void {
    if (!this.duckNode || !this.ctx) return;
    const g = this.duckNode.gain;
    const t = this.ctx.currentTime;
    const level = Math.pow(10, db / 20);
    g.cancelScheduledValues(t);
    g.setValueAtTime(attack > 0 ? g.value : level, t);
    if (attack > 0) g.linearRampToValueAtTime(level, t + attack);
    g.setValueAtTime(level, t + attack + hold);
    g.linearRampToValueAtTime(1, t + attack + hold + release);
  }

  /** Bring ducked music back now */
  unduck(release = 0.3): void {
    if (!this.duckNode || !this.ctx) return;
    const g = this.duckNode.gain;
    const t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(1, t + release);
  }

  /** Resume the audio context; call from a click or key handler if you want sound to start on that exact gesture */
  unlock(): Promise<void> {
    return this.context.resume();
  }

  private async begin(source: SongSource, token: number, options: PlayOptions): Promise<Performance | null> {
    try {
      const ctx = this.context;
      const song = await this.load(source);
      if (token !== this.token) return null;
      this.song = song;
      await prepareSong(ctx, song);
      if (token !== this.token) return null;
      return this.start(song, { fadeIn: options.fadeIn ?? (song.intro?.length ? 0.05 : 1.2), from: options.from });
    } finally {
      if (token === this.token) this.pending = null;
    }
  }

  private start(song: Song, options: { fadeIn: number; from?: number }): Performance {
    const ctx = this.context;
    const perf = new Performance(ctx, this.volumeNode!, song, { ...options, loops: this.loops, at: ctx.currentTime + 0.08 });
    for (const t of perf.tracks) if (this.carry.has(`${t.section}|${t.name}`)) t.muted = true;
    this.carry = new Set();
    this.perf = perf;
    this.runClock();
    return perf;
  }

  /** Fade out what is playing and cancel anything still loading; the current song is remembered (for resume and seek) */
  private halt(fade: number): void {
    this.token++;
    this.pending = null;
    this.pausedAt = null;
    this.perf?.stop(fade);
    this.perf = null;
  }

  private resolve(song: string | SongSource): SongSource {
    if (typeof song !== 'string') return song;
    const source = this.songs[song];
    if (!source) throw new Error(`Unknown song "${song}". Known: ${Object.keys(this.songs).join(', ') || '(none)'}`);
    return source;
  }

  private load(source: SongSource): Promise<Song> {
    if (typeof source !== 'function') return Promise.resolve(source);
    let p = this.loaded.get(source);
    if (!p) {
      p = source().then((m) => ('default' in m ? m.default : m));
      p.catch(() => this.loaded.delete(source));
      this.loaded.set(source, p);
    }
    return p;
  }

  /** Build the music bus (volume → duck → output stage) and arrange for the context to start on the first user gesture */
  private connect(ctx: AudioContext): void {
    this.volumeNode = ctx.createGain();
    this.volumeNode.gain.value = this.volumeLevel;
    this.duckNode = ctx.createGain();
    this.volumeNode.connect(this.duckNode).connect(createOutputStage(ctx, this.destination ?? ctx.destination));
    if (ctx.state !== 'suspended' || typeof window === 'undefined') return;
    const events = ['pointerdown', 'keydown', 'touchend'] as const;
    const unlock = () => void ctx.resume();
    for (const e of events) window.addEventListener(e, unlock, { capture: true });
    ctx.addEventListener('statechange', () => {
      if (ctx.state === 'running') for (const e of events) window.removeEventListener(e, unlock, { capture: true });
    });
  }

  private runClock(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => {
      if (!this.perf || !this.ctx) return;
      const hidden = typeof document !== 'undefined' && document.hidden;
      this.perf.schedule(this.ctx.currentTime + (hidden ? AHEAD_HIDDEN : AHEAD));
    }, 25);
  }
}

function mutedTracks(perf: Performance): Set<string> {
  return new Set(perf.tracks.filter((t) => t.muted).map((t) => `${t.section}|${t.name}`));
}
