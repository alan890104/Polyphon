// The tune on a roll of semitones: while singing, the voice's pitch drawn as it arrives against the metronome's beats; once written,
// the notes on their bars, with the voice they came from faint behind them and a playhead.

import { noteName, stepsPerBar, type Meter, type Part, type PitchFrame } from 'polyphon';
import { useEffect, useRef } from 'react';
import type { Take } from './take.ts';

// The player's colours (styles.css), for the canvas
const PAPER = '#eee7da';
const PAPER_3 = '#8a8174';
const LINE = 'rgb(238 231 218 / 0.07)';
const LINE_STRONG = 'rgb(238 231 218 / 0.16)';
const BRASS = '#c8a15a';
const BRASS_LIT = '#ecca86';
const INK = '#0f0e0c';
const MONO = '500 10px "IBM Plex Mono", ui-monospace, monospace';

/** Seconds of singing in view while recording, and where "now" sits across the width */
const LIVE_SPAN = 6;
const NOW_AT = 0.86;
/** Width of a sixteenth on the written roll */
const STEP_WIDTH = 10;
/** Room on the left of the written roll for the octave labels */
const GUTTER = 36;

interface Range {
  low: number;
  high: number;
}

/** Semitones from `low` to `high`, at least an octave and a half, centred on what was sung */
function rangeOf(pitches: number[], fallback: Range): Range {
  if (!pitches.length) return fallback;
  let low = Math.floor(Math.min(...pitches)) - 2;
  let high = Math.ceil(Math.max(...pitches)) + 2;
  const short = 18 - (high - low);
  if (short > 0) [low, high] = [low - Math.floor(short / 2), high + Math.ceil(short / 2)];
  return { low, high };
}

/** A canvas sized to its element at the screen's pixel density; returns its context in CSS pixels */
function prepare(canvas: HTMLCanvasElement, width: number, height: number): CanvasRenderingContext2D {
  const ratio = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  const g = canvas.getContext('2d')!;
  g.setTransform(ratio, 0, 0, ratio, 0, 0);
  g.clearRect(0, 0, width, height);
  return g;
}

/** Hairlines for the semitones (stronger at each C, which is labelled) */
function drawRows(g: CanvasRenderingContext2D, range: Range, width: number, y: (pitch: number) => number, labelAt: number): void {
  g.font = MONO;
  g.textBaseline = 'middle';
  for (let p = range.low; p <= range.high; p++) {
    const c = p % 12 === 0;
    g.fillStyle = c ? LINE_STRONG : LINE;
    g.fillRect(0, Math.round(y(p)), width, 1);
    if (c) {
      g.fillStyle = PAPER_3;
      g.fillText(noteName(p), labelAt, y(p) - 7);
    }
  }
}

/** The voice's pitch as a line, broken where it fell silent */
function drawVoice(g: CanvasRenderingContext2D, frames: readonly PitchFrame[], x: (time: number) => number, y: (pitch: number) => number, from: number, to: number, shift = 0): void {
  g.beginPath();
  let drawing = false;
  let previous = -Infinity;
  for (const frame of frames) {
    if (frame.time < from || frame.time > to || frame.pitch === null || frame.level < -60) {
      drawing = false;
      continue;
    }
    const [px, py] = [x(frame.time), y(frame.pitch + shift)];
    if (drawing && frame.time - previous < 0.03) g.lineTo(px, py);
    else g.moveTo(px, py);
    drawing = true;
    previous = frame.time;
  }
  g.stroke();
}

/** The voice as it comes in, with the clicks' beats and bars when there is a metronome */
export function LiveRoll({ take, beatsPerBar }: { take: Take; beatsPerBar: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let frame = 0;
    let range: Range = { low: 55, high: 74 };
    const draw = () => {
      frame = requestAnimationFrame(draw);
      const element = canvas.current;
      if (!element) return;
      const { clientWidth: width, clientHeight: height } = element;
      const g = prepare(element, width, height);
      const now = take.now();
      const scale = (width * NOW_AT) / LIVE_SPAN;
      const x = (time: number) => width * NOW_AT + (time - now) * scale;
      const frames = take.tracker.frames;
      // The range follows the voice, easing rather than jumping
      const recent = frames.filter((f) => f.pitch !== null && f.level > -60 && f.time > now - 12).map((f) => f.pitch!);
      const target = rangeOf(recent, range);
      range = { low: range.low + (target.low - range.low) * 0.08, high: range.high + (target.high - range.high) * 0.08 };
      const y = (pitch: number) => height - 8 - ((pitch - range.low) / (range.high - range.low)) * (height - 16);
      drawRows(g, { low: Math.ceil(range.low), high: Math.floor(range.high) }, width, y, 8);
      // Beats and bars, numbered from bar 1 after the count-in
      const first = take.beatTime(0);
      if (first !== null) {
        const beat = take.beatTime(1)! - first;
        g.font = MONO;
        g.textBaseline = 'top';
        for (let n = Math.floor((now - LIVE_SPAN - first) / beat) - 1; n * beat + first < now + LIVE_SPAN; n++) {
          const bx = Math.round(x(first + n * beat));
          const downbeat = n % beatsPerBar === 0;
          g.fillStyle = n < 0 ? LINE : downbeat ? LINE_STRONG : LINE;
          g.fillRect(bx, 0, 1, height);
          if (downbeat && n >= 0) {
            g.fillStyle = PAPER_3;
            g.fillText(String(n / beatsPerBar + 1), bx + 4, 6);
          }
        }
      }
      g.strokeStyle = PAPER;
      g.lineWidth = 2;
      g.lineJoin = 'round';
      drawVoice(g, frames, x, y, now - LIVE_SPAN * 1.2, now);
      // Where the voice is now
      const last = frames[frames.length - 1];
      if (last?.pitch != null && last.level > -60 && now - last.time < 0.15) {
        g.fillStyle = BRASS_LIT;
        g.beginPath();
        g.arc(x(last.time), y(last.pitch), 4, 0, 2 * Math.PI);
        g.fill();
      }
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [take, beatsPerBar]);
  return <canvas ref={canvas} className="roll roll--live" aria-hidden="true" />;
}

interface ScoreRollProps {
  part: Part;
  meter: Meter;
  bpm: number;
  /** Where the part's first step falls on the frames' clock */
  start: number;
  frames: readonly PitchFrame[];
  /** Semitones the notes were moved by from the voice (an octave up or down), for the voice to follow */
  transpose: number;
  /** The playhead, in steps, while the tune plays */
  playhead: (() => number | null) | null;
}

/** The written notes on their bars, the voice faint behind them; it scrolls sideways when the tune is longer than the view */
export function ScoreRoll({ part, meter, bpm, start, frames, transpose, playhead }: ScoreRollProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    const view = scroller.current;
    if (!element || !view) return;
    const bar = stepsPerBar(meter);
    const step = 15 / bpm;
    const pitches = part.notes.flatMap((n) => n.pitches);
    const range = rangeOf(pitches, { low: 55, high: 74 });
    let frame = 0;
    const draw = () => {
      const width = Math.max(view.clientWidth, GUTTER + part.duration * STEP_WIDTH + 24);
      const height = element.clientHeight;
      element.style.width = `${width}px`;
      const g = prepare(element, width, height);
      const x = (steps: number) => GUTTER + steps * STEP_WIDTH;
      const y = (pitch: number) => height - 10 - ((pitch - range.low) / (range.high - range.low)) * (height - 20);
      const row = (height - 20) / (range.high - range.low);
      drawRows(g, range, width, y, 6);
      g.font = MONO;
      g.textBaseline = 'top';
      for (let s = 0; s <= part.duration; s += 4) {
        const downbeat = s % bar === 0;
        g.fillStyle = downbeat ? LINE_STRONG : LINE;
        g.fillRect(Math.round(x(s)), 0, 1, height);
        if (downbeat && s < part.duration) {
          g.fillStyle = PAPER_3;
          g.fillText(String(s / bar + 1), x(s) + 4, 4);
        }
      }
      g.strokeStyle = 'rgb(238 231 218 / 0.32)';
      g.lineWidth = 1.5;
      g.lineJoin = 'round';
      drawVoice(g, frames, (time) => x((time - start) / step), y, start - step, start + (part.duration + 1) * step, transpose);
      const at = playhead?.() ?? null;
      for (const note of part.notes) {
        const playing = at !== null && at >= note.time && at < note.time + note.duration;
        for (const pitch of note.pitches) {
          const [left, top] = [x(note.time) + 1, y(pitch) - row / 2 + 1];
          const w = note.duration * STEP_WIDTH - 2;
          g.fillStyle = playing ? BRASS_LIT : BRASS;
          g.beginPath();
          g.roundRect(left, top, w, Math.max(4, row - 2), 3);
          g.fill();
          if (w >= 26 && row >= 11) {
            g.fillStyle = INK;
            g.textBaseline = 'middle';
            g.fillText(noteName(pitch), left + 4, y(pitch) + 0.5);
          }
        }
      }
      if (at !== null) {
        g.fillStyle = BRASS_LIT;
        g.fillRect(Math.round(x(at)), 0, 1, height);
        // Keep the playhead in view
        const px = x(at);
        if (px < view.scrollLeft + 40 || px > view.scrollLeft + view.clientWidth - 80) view.scrollLeft = px - 40;
      }
    };
    const loop = () => {
      draw();
      frame = requestAnimationFrame(loop);
    };
    if (playhead) loop();
    else draw();
    const resize = new ResizeObserver(() => draw());
    resize.observe(view);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
    };
  }, [part, meter, bpm, start, frames, transpose, playhead]);
  return (
    <div ref={scroller} className="roll-scroller">
      <canvas ref={canvas} className="roll" aria-hidden="true" />
    </div>
  );
}
