// The player: a Jukebox plus a playlist queue (next, previous, shuffle, repeat), a mixer and an analyser for the visuals.
// It reads the Jukebox once per animation frame (the one place it is polled) and publishes the state the UI renders.

import { encodeWav, Jukebox, renderSong, type JukeboxState, type Playback, type Song } from 'polyphon';
import { errorMessage } from './format.ts';
import { playable, type LibraryPlaylist, type ReadySong } from './library.ts';

export type RepeatMode = 'off' | 'all' | 'one';

export interface PlayerState {
  status: JukeboxState;
  /** The playlist the current song was started from */
  playlist: LibraryPlaylist | null;
  /** The song asked for last (it stays current after it ends) */
  song: ReadySong | null;
  /** Seconds into the song */
  position: number;
  /** The live playback: a new one after every seek, pause and resume, and null while paused or loading */
  playback: Playback | null;
  /** Names of the muted track groups */
  muted: ReadonlySet<string>;
  shuffle: boolean;
  repeat: RepeatMode;
  /** 0-1 */
  volume: number;
  /** Why the current song failed to start */
  error: string | null;
}

/** previous() restarts the song when it is further in than this (seconds), and goes to the song before otherwise */
const RESTART_AFTER = 3;
const NEXT_REPEAT: Record<RepeatMode, RepeatMode> = { off: 'all', all: 'one', one: 'off' };

export class Player {
  private current: PlayerState = {
    status: 'idle',
    playlist: null,
    song: null,
    position: 0,
    playback: null,
    muted: new Set(),
    shuffle: false,
    repeat: 'off',
    volume: 0.8,
    error: null,
  };
  private readonly listeners = new Set<() => void>();
  /** Built on the first play, since browsers only let audio start after a click or a key press */
  private audio: { jukebox: Jukebox; analyser: AnalyserNode } | null = null;
  /** The current playlist's playable songs in playback order (shuffled when shuffle is on) */
  private order: readonly ReadySong[] = [];
  /** The playback last read from the Jukebox */
  private adopted: Playback | null = null;

  get state(): PlayerState {
    return this.current;
  }

  /** The analyser at the end of the audio chain, for the music's level (null until the first song plays) */
  get analyser(): AnalyserNode | null {
    return this.audio?.analyser ?? null;
  }

  /** Call `listener` whenever the state changes; returns the unsubscribe function (the shape useSyncExternalStore expects) */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Play a song from a playlist (a paused song resumes, the playing one carries on) */
  play(playlist: LibraryPlaylist, song: ReadySong): void {
    this.order = playbackOrder(playlist, song, this.current.shuffle);
    void this.start(playlist, song);
  }

  /** Play a playlist from its first song (a random one when shuffling) */
  playAll(playlist: LibraryPlaylist): void {
    const songs = playable(playlist);
    if (!songs.length) return;
    this.play(playlist, this.current.shuffle ? songs[Math.floor(Math.random() * songs.length)] : songs[0]);
  }

  /** A playlist gained songs (an import): when it is the one playing, the new songs join the end of the playback order */
  updatePlaylist(playlist: LibraryPlaylist): void {
    if (this.current.playlist?.id !== playlist.id) return;
    this.order = [...this.order, ...playable(playlist).filter((s) => !this.order.includes(s))];
    this.set({ playlist });
  }

  /** Pause, resume, or play the current song again after it ended */
  toggle(): void {
    const { status, playlist, song } = this.current;
    if (!this.audio || !playlist || !song) return;
    if (status === 'playing') this.audio.jukebox.pause();
    else if (status === 'paused') this.audio.jukebox.resume();
    else if (status === 'idle') void this.start(playlist, song);
    this.sync();
  }

  next(): void {
    this.skip(1, true);
  }

  previous(): void {
    if (this.current.position > RESTART_AFTER) this.seek(0);
    else this.skip(-1, true);
  }

  seek(seconds: number): void {
    const { song } = this.current;
    if (!this.audio || !song) return;
    this.audio.jukebox.seek(Math.min(Math.max(0, seconds), song.duration));
    this.sync();
  }

  seekBy(seconds: number): void {
    this.seek(this.current.position + seconds);
  }

  setVolume(volume: number): void {
    const level = Math.min(1, Math.max(0, volume));
    if (this.audio) this.audio.jukebox.volume = level;
    this.set({ volume: level });
  }

  setShuffle(shuffle: boolean): void {
    const { playlist, song } = this.current;
    if (playlist && song) this.order = playbackOrder(playlist, song, shuffle);
    this.set({ shuffle });
  }

  /** Off → all → one → off */
  cycleRepeat(): void {
    this.set({ repeat: NEXT_REPEAT[this.current.repeat] });
  }

  toggleMute(name: string): void {
    const muted = new Set(this.current.muted);
    if (!muted.delete(name)) muted.add(name);
    this.setMuted(muted);
  }

  /** Solo a track group by muting every other one; soloing it again unmutes them all */
  toggleSolo(name: string): void {
    const { song, muted } = this.current;
    if (!song) return;
    const names = song.tracks.map((t) => t.name);
    this.setMuted(soloist(names, muted) === name ? new Set() : new Set(names.filter((n) => n !== name)));
  }

  /** Render a song offline as a WAV file. At the live context's sample rate, the samples prepared for playback are reused. */
  async exportWav(song: Song): Promise<Blob> {
    const buffer = await renderSong(song, { loops: 1, sampleRate: this.connect().jukebox.context.sampleRate });
    return new Blob([encodeWav(buffer)], { type: 'audio/wav' });
  }

  private async start(playlist: LibraryPlaylist, song: ReadySong): Promise<void> {
    const { jukebox } = this.connect();
    void jukebox.unlock();
    this.set({ playlist, song, error: null, muted: song === this.current.song ? this.current.muted : new Set() });
    const started = jukebox.play(song.song, { loops: 1 });
    this.sync();
    try {
      await started;
    } catch (error) {
      if (this.current.song === song) this.set({ error: errorMessage(error) });
    }
    this.sync();
  }

  /** Move through the playback order; past either end it wraps around, or stops when `wrap` is false */
  private skip(step: 1 | -1, wrap: boolean): void {
    const { playlist, song } = this.current;
    const count = this.order.length;
    if (!playlist || !song || !count) return;
    const index = this.order.indexOf(song) + step;
    if (!wrap && (index < 0 || index >= count)) return;
    const target = this.order[(index + count) % count];
    if (target === song) this.seek(0);
    else void this.start(playlist, target);
  }

  /** The current song reached its end: play it again, or move on through the playlist */
  private advance(): void {
    if (this.current.repeat === 'one') this.seek(0);
    else this.skip(1, this.current.repeat === 'all');
  }

  private setMuted(muted: ReadonlySet<string>): void {
    this.set({ muted });
    this.applyMutes();
  }

  /** Make the live playback's tracks match the mute state */
  private applyMutes(): void {
    for (const track of this.audio?.jukebox.playback?.tracks ?? []) {
      const muted = this.current.muted.has(track.name);
      if (track.muted !== muted) track.muted = muted;
    }
  }

  /** Read the Jukebox and publish what changed */
  private sync(): void {
    const jukebox = this.audio?.jukebox;
    if (!jukebox) return;
    const { state: status, position, playback } = jukebox;
    if (playback !== this.adopted) this.adopt(playback);
    const s = this.current;
    if (status !== s.status || position !== s.position || playback !== s.playback) this.set({ status, position, playback });
  }

  /**
   * A new playback started (a song, a seek or a resume): give it the mute state, and move on when it ends.
   */
  private adopt(playback: Playback | null): void {
    this.adopted = playback;
    if (!playback) return;
    this.applyMutes();
    void playback.finished.then(() => {
      if (this.audio?.jukebox.playback === playback) this.advance();
    });
  }

  private connect(): { jukebox: Jukebox; analyser: AnalyserNode } {
    if (this.audio) return this.audio;
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.connect(context.destination);
    this.audio = { jukebox: new Jukebox({ context, destination: analyser, volume: this.current.volume }), analyser };
    const poll = () => {
      this.sync();
      requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
    return this.audio;
  }

  private set(patch: Partial<PlayerState>): void {
    this.current = { ...this.current, ...patch };
    for (const listener of this.listeners) listener();
  }
}

/** The one track group left unmuted while every other one is muted (null otherwise) */
export function soloist(names: readonly string[], muted: ReadonlySet<string>): string | null {
  const open = names.filter((n) => !muted.has(n));
  return names.length > 1 && open.length === 1 ? open[0] : null;
}

/** A playlist's playable songs in order, or shuffled with `first` at the front */
function playbackOrder(playlist: LibraryPlaylist, first: ReadySong, shuffle: boolean): ReadySong[] {
  const songs = playable(playlist);
  if (!shuffle) return songs;
  const rest = songs.filter((s) => s !== first);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [first, ...rest];
}
