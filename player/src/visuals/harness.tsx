// The visualizer's development harness (player/visuals.html): plays an example song through a Jukebox with an analyser and
// mounts the immersive view on its own, to work on the visuals and screenshot them without the main app.
// URL parameters: song (an example id such as moonlight or eldor-boss; default after-midnight), from (seconds), and style,
// background, theme to override the stored settings. window.harness drives it from the console or an end-to-end script.

import { Jukebox, songDuration, type JukeboxState, type Playback, type Song } from 'polyphon';
import { StrictMode, useEffect, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { playlists } from '../../../examples/index.ts';
import { ImmersiveView } from './ImmersiveView.tsx';
import { loadSettings, prefersReducedMotion, saveSettings, type VisualSettings } from './settings.ts';

const SONGS = playlists.flatMap((p) => p.songs.map((s) => ({ ...s, playlist: p.title })));

interface HarnessState {
  status: JukeboxState;
  position: number;
  playback: Playback | null;
  song: Song | null;
  playlist: string;
  /** Seconds for one pass: the intro, then the body once */
  duration: number;
  /** The audio context is running (browsers hold it until a click) */
  audible: boolean;
}

class Harness {
  readonly context = new AudioContext();
  readonly analyser = this.context.createAnalyser();
  readonly jukebox: Jukebox;
  private index = 0;
  private current: HarnessState = { status: 'idle', position: 0, playback: null, song: null, playlist: '', duration: 0, audible: false };
  private readonly listeners = new Set<() => void>();

  constructor() {
    // The same analyser the player builds
    this.analyser.fftSize = 4096;
    this.analyser.minDecibels = -90;
    this.analyser.maxDecibels = -25;
    this.analyser.smoothingTimeConstant = 0.8;
    this.analyser.connect(this.context.destination);
    this.jukebox = new Jukebox({ context: this.context, destination: this.analyser, volume: 0.8 });
    const poll = () => {
      this.sync();
      requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  }

  get state(): HarnessState {
    return this.current;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Play an example song by id (or index; an unknown id plays the first), from a point in seconds */
  async play(id: string | number, from = 0): Promise<void> {
    const index = typeof id === 'number' ? id : Math.max(0, SONGS.findIndex((s) => s.id === id));
    this.index = (index + SONGS.length) % SONGS.length;
    const entry = SONGS[this.index];
    const song = await entry.load();
    const { intro, loop } = songDuration(song);
    this.set({ song, playlist: entry.playlist, duration: intro + loop });
    void this.context.resume();
    await this.jukebox.play(song, { loops: 1, from });
    this.sync();
  }

  toggle(): void {
    if (this.jukebox.state === 'playing') this.jukebox.pause();
    else if (this.jukebox.state === 'paused') this.jukebox.resume();
    else void this.play(this.index);
    void this.context.resume();
    this.sync();
  }

  next(): void {
    void this.play(this.index + 1);
  }

  previous(): void {
    if (this.jukebox.position > 3) this.seek(0);
    else void this.play(this.index - 1);
  }

  seek(seconds: number): void {
    this.jukebox.seek(seconds);
    this.sync();
  }

  private sync(): void {
    const { state: status, position, playback } = this.jukebox;
    const audible = this.context.state === 'running';
    const s = this.current;
    if (status !== s.status || position !== s.position || playback !== s.playback || audible !== s.audible) this.set({ status, position, playback, audible });
  }

  private set(patch: Partial<HarnessState>): void {
    this.current = { ...this.current, ...patch };
    for (const listener of this.listeners) listener();
  }
}

declare global {
  interface Window {
    harness?: Harness;
    /** Change the stored settings and mount the view again with them */
    applyVisualSettings?: (patch: Partial<VisualSettings>) => void;
  }
}

function HarnessView({ harness }: { harness: Harness }) {
  const state = useSyncExternalStore(harness.subscribe, () => harness.state);
  const [open, setOpen] = useState(true);
  const [mount, setMount] = useState(0);
  useEffect(() => {
    window.applyVisualSettings = (patch) => {
      saveSettings({ ...loadSettings(prefersReducedMotion()), ...patch });
      setMount((n) => n + 1);
      setOpen(true);
    };
  }, []);

  return (
    <>
      {open ? (
        <ImmersiveView
          key={mount}
          analyser={harness.analyser}
          song={state.song}
          playlistName={state.playlist}
          position={state.position}
          duration={state.duration}
          playing={state.status === 'playing'}
          loading={state.status === 'loading'}
          playback={state.playback}
          onTogglePlay={() => harness.toggle()}
          onNext={() => harness.next()}
          onPrevious={() => harness.previous()}
          onSeek={(seconds) => harness.seek(seconds)}
          onClose={() => setOpen(false)}
        />
      ) : (
        <button type="button" className="harness-reopen" onClick={() => setOpen(true)}>
          Open the visualizer
        </button>
      )}
      {!state.audible && state.song && (
        <button type="button" className="harness-start" onClick={() => void harness.context.resume()}>
          Click to start the sound
        </button>
      )}
    </>
  );
}

const container = document.getElementById('root')!;
// A hot update runs this module again (and then reloads the page): mount once
if (!container.dataset.mounted) {
  container.dataset.mounted = 'true';
  const params = new URLSearchParams(location.search);
  const overrides: Partial<VisualSettings> = {};
  for (const key of ['style', 'background', 'theme'] as const) {
    const value = params.get(key);
    if (value) Object.assign(overrides, { [key]: value });
  }
  if (Object.keys(overrides).length) saveSettings({ ...loadSettings(prefersReducedMotion()), ...overrides });

  const harness = new Harness();
  window.harness = harness;
  void harness.play(params.get('song') ?? 'after-midnight', Number(params.get('from') ?? 0));

  createRoot(container).render(
    <StrictMode>
      <HarnessView harness={harness} />
    </StrictMode>,
  );
}
