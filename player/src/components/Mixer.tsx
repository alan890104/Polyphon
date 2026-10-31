// The mixer: one row per track group (an intro track and a body track with the same name share a row), with a live level
// meter and mute and solo toggles. Solo mutes every other row.

import type { Playback } from 'polyphon';
import { useEffect, useMemo, useRef } from 'react';
import { twoDigits } from '../format.ts';
import type { ReadySong } from '../library.ts';
import { soloist } from '../player.ts';
import { useAnimationFrame } from '../useAnimationFrame.ts';
import { usePlayer, usePlayerState } from '../usePlayer.ts';
import { IconButton } from './IconButton.tsx';

const METER_SAMPLES = 1024;
/** How much of its level a meter keeps from one frame to the next as the sound fades */
const METER_FALL = 0.92;
/** The quietest level a meter shows (dB) */
const METER_FLOOR = -48;

export function Mixer({ song }: { song: ReadySong }) {
  const player = usePlayer();
  const muted = usePlayerState((s) => s.muted);
  const playback = usePlayerState((s) => s.playback);
  const outputs = useMemo(() => outputsByName(playback), [playback]);
  const solo = soloist(song.tracks.map((t) => t.name), muted);

  return (
    <section className="mixer">
      <h3 className="label">Mixer</h3>
      <ul>
        {song.tracks.map(({ name, instruments }, i) => (
          <li key={name} className="mixer__row" data-muted={muted.has(name) ? '' : undefined}>
            <span className="mixer__channel">{twoDigits(i + 1)}</span>
            <span className="mixer__label">
              <span className="mixer__name">{name}</span>
              <span className="mixer__instrument">{instruments.join(', ')}</span>
            </span>
            <LevelMeter sources={outputs.get(name)} />
            <IconButton className="mixer__toggle" label={`Mute ${name}`} pressed={muted.has(name)} onClick={() => player.toggleMute(name)}>
              M
            </IconButton>
            <IconButton className="mixer__toggle" label={`Solo ${name}`} pressed={solo === name} onClick={() => player.toggleSolo(name)}>
              S
            </IconButton>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The outputs of each track group in a playback */
function outputsByName(playback: Playback | null): Map<string, AudioNode[]> {
  const outputs = new Map<string, AudioNode[]>();
  for (const track of playback?.tracks ?? []) outputs.set(track.name, [...(outputs.get(track.name) ?? []), track.output]);
  return outputs;
}

/** The peak level of a track group: it jumps up at once and falls back slowly */
function LevelMeter({ sources }: { sources: AudioNode[] | undefined }) {
  const fill = useRef<HTMLDivElement>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const level = useRef(0);
  const samples = useMemo(() => new Float32Array(METER_SAMPLES), []);

  // Listen to the live playback's tracks; a seek, a pause or a new song replaces them
  useEffect(() => {
    if (!sources?.length) return;
    const node = sources[0].context.createAnalyser();
    node.fftSize = METER_SAMPLES;
    for (const source of sources) source.connect(node);
    analyser.current = node;
    return () => {
      for (const source of sources) source.disconnect(node);
      analyser.current = null;
    };
  }, [sources]);

  useAnimationFrame(() => {
    let peak = 0;
    if (analyser.current) {
      analyser.current.getFloatTimeDomainData(samples);
      for (const x of samples) peak = Math.max(peak, Math.abs(x));
    }
    level.current = Math.max(meterLevel(peak), level.current * METER_FALL);
    if (fill.current) fill.current.style.transform = `scaleX(${level.current})`;
  });

  return (
    <div className="meter" aria-hidden="true">
      <div ref={fill} className="meter__fill" />
    </div>
  );
}

/** A peak amplitude on the meter's decibel scale, 0-1 */
function meterLevel(peak: number): number {
  return peak > 0 ? Math.min(1, Math.max(0, 1 - (20 * Math.log10(peak)) / METER_FLOOR)) : 0;
}
