// The immersive visualizer: a full-screen view of the song playing, with audio-reactive styles over animated backgrounds, the
// title in large type, minimal transport controls that hide when idle, and a settings drawer. Esc closes it.

import type { Playback, Song } from 'polyphon';
import { useEffect, useEffectEvent, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { backgroundById } from './backgrounds/index.ts';
import { VisualEngine, type EngineSettings } from './engine.ts';
import { grainTile } from './grain.ts';
import { CloseIcon, NextIcon, PauseIcon, PlayIcon, PreviousIcon } from '../components/Icons.tsx';
import { EnterFullscreenIcon, ExitFullscreenIcon, SettingsIcon } from './icons.tsx';
import type { VisualSettings } from './settings.ts';
import { SettingsDrawer } from './SettingsDrawer.tsx';
import { styleById } from './styles/index.ts';
import { themeById } from './themes.ts';
import { NoteTimeline } from './timeline.ts';
import { useBackgroundImage } from './useBackgroundImage.ts';
import { useIdle } from './useIdle.ts';
import { useVisualSettings } from './useVisualSettings.ts';
import './immersive.css';

export interface ImmersiveViewProps {
  /** The analyser at the end of the audio chain (null until the first song plays: the visuals rest) */
  analyser: AnalyserNode | null;
  /** The song playing, paused or loading (null when there is none) */
  song: Song | null;
  /** The playlist it was started from, shown above the title */
  playlistName?: string;
  /** Seconds into the song */
  position: number;
  /** Seconds the song lasts */
  duration: number;
  playing: boolean;
  /** The song's samples are being prepared */
  loading?: boolean;
  /** The live playback: when given, the visuals read its audio clock every frame for exact timing */
  playback?: Playback | null;
  onTogglePlay: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  /** Allows seeking from the progress line and the arrow keys */
  onSeek?: (seconds: number) => void;
  /** Esc, F and the close button close the view (leaving the browser's full screen first) */
  onClose: () => void;
}

/** Seconds the arrow keys seek */
const SEEK_STEP = 5;

export function ImmersiveView(props: ImmersiveViewProps) {
  const { analyser, song, playlistName, position, duration, playing, loading = false, playback = null } = props;
  const { onTogglePlay, onNext, onPrevious, onSeek, onClose } = props;
  const { settings, update, reset } = useVisualSettings();
  const picture = useBackgroundImage();
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const engine = useRef<VisualEngine | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [inset, setInset] = useState(0);
  const fullscreen = useFullscreen();
  const idle = useIdle(root, settings.autoHide && !drawer);
  const drawerId = useId();
  const theme = themeById(settings.theme);
  const timeline = useMemo(() => (song ? new NoteTimeline(song) : null), [song]);

  // The engine lives as long as the view; everything else is handed to it as it changes
  useEffect(() => {
    if (!stage.current) return;
    const created = new VisualEngine(stage.current, engineSettings(settings), { onInset: setInset });
    engine.current = created;
    if (import.meta.env.DEV) Object.assign(window, { visualEngine: created });
    return () => {
      created.dispose();
      engine.current = null;
    };
    // Created once: settings reach it through the effect below (creating it again would restart the animation)
  }, []);
  useEffect(() => engine.current?.update(engineSettings(settings)), [settings]);
  useEffect(() => engine.current?.setAnalyser(analyser), [analyser]);
  useEffect(() => engine.current?.setTimeline(timeline), [timeline]);
  useEffect(() => engine.current?.setClock({ position, playing, playback }), [position, playing, playback]);
  useEffect(() => engine.current?.setImage(picture.image), [picture.image]);

  // Focus the view so the keys work at once, and give focus back on the way out
  useEffect(() => {
    const before = document.activeElement;
    root.current?.focus({ preventScroll: true });
    return () => {
      if (before instanceof HTMLElement) before.focus({ preventScroll: true });
    };
  }, []);
  const close = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    onClose();
  };

  // Keys, on the document so they come before the app's own shortcuts (which skip a key once it is handled)
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || isTyping(e.target)) return;
    if (e.key === 'Escape') {
      if (drawer) setDrawer(false);
      else close();
    } else if (e.key === 'f' || e.key === 'F') close();
    else if (e.key === ' ' || e.key === 'k') {
      if (isControl(e.target)) return;
      if (!e.repeat) onTogglePlay();
    } else if (e.key === 'ArrowLeft' && onSeek && !isControl(e.target)) onSeek(Math.max(0, position - SEEK_STEP));
    else if (e.key === 'ArrowRight' && onSeek && !isControl(e.target)) onSeek(Math.min(duration, position + SEEK_STEP));
    else return;
    e.preventDefault();
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKey(e);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);

  const showChrome = !idle;
  const style = {
    '--iv-ink': theme.ink,
    '--iv-paper': theme.paper,
    '--iv-muted': theme.muted,
    '--iv-accent': theme.accent,
    '--iv-grain': grainTile(),
    '--iv-inset': `${inset}px`,
  };

  return (
    <div
      ref={root}
      className={`immersive${showChrome ? '' : ' immersive--idle'}${drawer ? ' immersive--drawer' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={song ? `Visualizer: ${song.title}` : 'Visualizer'}
      tabIndex={-1}
      style={style}
      onKeyDown={trapTab}
    >
      <div ref={stage} className="immersive__stage" aria-hidden="true" />
      <div className="immersive__grain" aria-hidden="true" />
      <div className="immersive__shade" aria-hidden="true" />

      {settings.showTitle && song && (
        <header className="immersive__caption">
          {playlistName && <p className="immersive__eyebrow">{playlistName}</p>}
          <h2 className="immersive__title">{song.title}</h2>
          <p className="immersive__clock">
            {loading ? (
              'Preparing the instruments…'
            ) : (
              <>
                <span>{clock(position)}</span>
                <span className="immersive__clock-rule" aria-hidden="true" />
                <span>{clock(duration)}</span>
              </>
            )}
          </p>
        </header>
      )}
      {!song && <p className="immersive__empty">Nothing is playing.</p>}

      <div className="immersive__chrome immersive__chrome--top">
        <button
          type="button"
          className="immersive-button"
          aria-label="Settings"
          title="Settings"
          aria-expanded={drawer}
          aria-controls={drawerId}
          onClick={() => setDrawer((open) => !open)}
        >
          <SettingsIcon />
        </button>
        {document.fullscreenEnabled && (
          <button
            type="button"
            className="immersive-button"
            aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
            title={fullscreen ? 'Exit full screen' : 'Full screen'}
            onClick={() => void toggleFullscreen()}
          >
            {fullscreen ? <ExitFullscreenIcon /> : <EnterFullscreenIcon />}
          </button>
        )}
        <button type="button" className="immersive-button" aria-label="Close visualizer" title="Close (Esc or F)" onClick={close}>
          <CloseIcon />
        </button>
      </div>

      <footer className="immersive__footer">
        {song && <Progress position={position} duration={duration} onSeek={onSeek} />}
        <div className="immersive__chrome immersive__transport">
          {onPrevious && (
            <button type="button" className="immersive-button" aria-label="Previous" title="Previous" disabled={!song} onClick={onPrevious}>
              <PreviousIcon />
            </button>
          )}
          <button
            type="button"
            className="immersive-button immersive-button--play"
            aria-label={playing ? 'Pause' : 'Play'}
            title={playing ? 'Pause (Space)' : 'Play (Space)'}
            disabled={!song}
            onClick={onTogglePlay}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          {onNext && (
            <button type="button" className="immersive-button" aria-label="Next" title="Next" disabled={!song} onClick={onNext}>
              <NextIcon />
            </button>
          )}
        </div>
      </footer>

      {drawer && <SettingsDrawer id={drawerId} settings={settings} update={update} reset={reset} picture={picture} onClose={() => setDrawer(false)} />}
    </div>
  );
}

/** The position as a hairline, which seeks when it can */
function Progress({ position, duration, onSeek }: { position: number; duration: number; onSeek?: (seconds: number) => void }) {
  const fraction = duration > 0 ? Math.min(1, position / duration) : 0;
  return (
    <input
      className="immersive__chrome immersive__seek"
      type="range"
      min={0}
      max={Math.max(1, duration)}
      step={0.1}
      value={Math.min(position, duration)}
      disabled={!onSeek}
      aria-label="Position"
      aria-valuetext={`${clock(position)} of ${clock(duration)}`}
      style={{ '--fill': fraction }}
      onChange={(e) => onSeek?.(Number(e.target.value))}
    />
  );
}

function engineSettings(s: VisualSettings): EngineSettings {
  return {
    style: styleById(s.style),
    background: backgroundById(s.background),
    theme: themeById(s.theme),
    motion: s.motion,
    sensitivity: s.sensitivity,
    mirror: s.mirror,
    layered: s.layered,
  };
}

function useFullscreen(): boolean {
  const [on, setOn] = useState(() => document.fullscreenElement !== null);
  useEffect(() => {
    const onChange = () => setOn(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  return on;
}

/** The whole page goes full screen (the view covers it), so an opener can ask for it in the same click before the view mounts */
async function toggleFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  } catch {
    // Refused (no user gesture, or not allowed in this frame): the view stays as it is
  }
}

/** Keep Tab inside the dialog */
function trapTab(e: ReactKeyboardEvent<HTMLDivElement>): void {
  if (e.key !== 'Tab') return;
  const focusable = [...e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex="0"]')].filter(
    (el) => el.offsetParent !== null,
  );
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && (document.activeElement === first || document.activeElement === e.currentTarget)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/** Seconds as a clock: 83 → "1:23" */
function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || target.matches('input[type="text"], input[type="search"], textarea, select'));
}

/** A focused control that answers Space or the arrows itself (a button, a slider, a radio) */
function isControl(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.matches('button, input, select, textarea');
}
