// Hum a tune: sing into the microphone (with a metronome, or at your own pace) or open a recording, and get the notes written out,
// played back on an instrument beside the voice they came from, and added to the library as a song.

import { defineSong, formatMelody, Jukebox, noteName, stepsPerBar, transcribe, transpose, type InstrumentName, type Meter, type Song } from 'polyphon';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { IconButton } from '../components/IconButton.tsx';
import { CloseIcon, CopyIcon, MicIcon, PlayIcon, StopIcon, WaveIcon } from '../components/Icons.tsx';
import { errorMessage, formatTime, plural } from '../format.ts';
import { LiveRoll, ScoreRoll } from './Roll.tsx';
import { hearFile, Take, type Heard } from './take.ts';
import './hum.css';

const INSTRUMENTS: [InstrumentName, string][] = [
  ['piano', 'Piano'],
  ['musicbox', 'Music box'],
  ['flute', 'Flute'],
  ['clarinet', 'Clarinet'],
  ['violin', 'Violin'],
  ['cello', 'Cello'],
  ['vibes', 'Vibraphone'],
  ['harp', 'Harp'],
];
const METERS: Meter[] = ['4/4', '3/4'];

type Stage =
  | { name: 'ready'; error?: string }
  | { name: 'opening' }
  | { name: 'listening'; take: Take }
  | { name: 'reading'; file: string }
  | { name: 'written'; heard: Heard; title: string; from: 'voice' | 'file' };

interface HumStudioProps {
  /** The title for a tune sung in: 'Hummed tune 3' */
  title: string;
  onAdd: (song: Song) => void;
  onClose: () => void;
}

export default function HumStudio({ title, onAdd, onClose }: HumStudioProps) {
  const [stage, setStage] = useState<Stage>({ name: 'ready' });
  const [click, setClick] = useState(true);
  const [bpm, setBpm] = useState(90);
  const [meter, setMeter] = useState<Meter>('4/4');
  const context = useRef<AudioContext | null>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const audio = () => (context.current ??= new AudioContext());

  useEffect(() => {
    sheet.current?.focus();
    return () => {
      void context.current?.close();
      context.current = null;
    };
  }, []);
  // A take lets go of the microphone when it is done with, however that happens
  useEffect(() => {
    if (stage.name === 'listening') return () => stage.take.close();
  }, [stage]);

  const record = async () => {
    setStage({ name: 'opening' });
    try {
      const take = await Take.open(audio());
      take.start({ bpm: click ? bpm : null, beatsPerBar: stepsPerBar(meter) / 4 });
      setStage({ name: 'listening', take });
    } catch (error) {
      setStage({ name: 'ready', error: errorMessage(error) });
    }
  };
  const open = async (file: File) => {
    setStage({ name: 'reading', file: file.name });
    try {
      const heard = await hearFile(file, audio());
      setStage({ name: 'written', heard, title: file.name.replace(/\.[^.]+$/, ''), from: 'file' });
    } catch (error) {
      setStage({ name: 'ready', error: errorMessage(error) });
    }
  };

  return (
    <div className="studio" role="dialog" aria-modal="true" aria-label="Hum a tune">
      <div
        ref={sheet}
        className="studio__sheet"
        tabIndex={-1}
        // The studio's keys stay in the studio: Space must not play the library behind it
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key !== 'Escape') return;
          if (stage.name === 'listening') setStage({ name: 'ready' });
          else onClose();
        }}
      >
        <header className="studio__head">
          <p className="label">Hum a tune</p>
          <IconButton label="Close" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </header>
        {(stage.name === 'ready' || stage.name === 'opening') && (
          <Setup
            click={click}
            bpm={bpm}
            meter={meter}
            busy={stage.name === 'opening'}
            error={stage.name === 'ready' ? stage.error : undefined}
            onClick={setClick}
            onBpm={setBpm}
            onMeter={setMeter}
            onRecord={() => void record()}
            onOpen={(file) => void open(file)}
          />
        )}
        {stage.name === 'listening' && (
          <Listening take={stage.take} meter={meter} onDone={() => setStage({ name: 'written', heard: stage.take.stop(), title, from: 'voice' })} />
        )}
        {stage.name === 'reading' && (
          <div className="studio__reading">
            <span className="spinner" />
            <p>Listening to {stage.file}</p>
          </div>
        )}
        {stage.name === 'written' && (
          <Written
            heard={stage.heard}
            title={stage.title}
            from={stage.from}
            meter={meter}
            context={audio()}
            onMeter={setMeter}
            onAdd={onAdd}
            onAgain={() => setStage({ name: 'ready' })}
          />
        )}
      </div>
    </div>
  );
}

interface SetupProps {
  click: boolean;
  bpm: number;
  meter: Meter;
  busy: boolean;
  error?: string;
  onClick: (click: boolean) => void;
  onBpm: (bpm: number) => void;
  onMeter: (meter: Meter) => void;
  onRecord: () => void;
  onOpen: (file: File) => void;
}

function Setup({ click, bpm, meter, busy, error, onClick, onBpm, onMeter, onRecord, onOpen }: SetupProps) {
  const file = useRef<HTMLInputElement>(null);
  return (
    <>
      <h2 className="studio__title">Sing it, see it written</h2>
      <p className="studio__lede">
        Hum or sing on “da”, a syllable for every note. With the click, come in after one bar of it; without, sing at your own pace and
        the tempo is found afterwards.
      </p>
      <div className="studio__settings">
        <Setting label="Click">
          <Choice options={[[true, 'On'], [false, 'Off']]} value={click} onChange={onClick} label="Metronome" />
        </Setting>
        <Setting label="Tempo">
          <Stepper value={bpm} min={50} max={180} step={5} unit="BPM" disabled={!click} onChange={onBpm} label="Tempo" />
        </Setting>
        <Setting label="Meter">
          <Choice options={METERS.map((m) => [m, String(m)])} value={meter} onChange={onMeter} label="Meter" />
        </Setting>
      </div>
      <div className="studio__actions">
        <button type="button" className="studio__primary" disabled={busy} onClick={onRecord}>
          {busy ? <span className="spinner" /> : <MicIcon />}
          Start singing
        </button>
        <button type="button" className="studio__secondary" disabled={busy} onClick={() => file.current?.click()}>
          <WaveIcon />
          Open a recording
        </button>
        <input
          ref={file}
          type="file"
          accept="audio/*"
          hidden
          onChange={(e) => {
            const chosen = e.currentTarget.files?.[0];
            e.currentTarget.value = '';
            if (chosen) onOpen(chosen);
          }}
        />
      </div>
      {error && (
        <p className="studio__error" role="alert">
          {error}
        </p>
      )}
      <p className="studio__note label">Headphones keep the click out of the recording. Nothing leaves this tab.</p>
    </>
  );
}

/** Singing: the count-in, the beat, the note being sung and the voice drawn as it arrives */
function Listening({ take, meter, onDone }: { take: Take; meter: Meter; onDone: () => void }) {
  const beatsPerBar = stepsPerBar(meter) / 4;
  const status = useRef<HTMLParagraphElement>(null);
  const note = useRef<HTMLParagraphElement>(null);
  const dots = useRef<HTMLOListElement>(null);
  // Read the take every frame and write straight into the page: a render per frame would be wasted on three bits of text
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = requestAnimationFrame(update);
      const beat = take.beat();
      const counting = beat !== null && beat < 0;
      if (status.current) status.current.textContent = counting ? 'Come in after the count' : beat === null ? `Listening ${formatTime(take.now())}` : `Bar ${Math.floor(beat / beatsPerBar) + 1}`;
      if (dots.current && beat !== null) dots.current.dataset.beat = String((((Math.floor(beat) % beatsPerBar) + beatsPerBar) % beatsPerBar) + 1);
      if (!note.current) return;
      const last = take.tracker.frames[take.tracker.frames.length - 1];
      const voiced = last?.pitch != null && last.level > -55;
      if (counting) note.current.textContent = String(-Math.floor(beat));
      else if (voiced) note.current.textContent = noteName(Math.round(last.pitch!));
      note.current.toggleAttribute('data-quiet', counting || !voiced);
    };
    update();
    return () => cancelAnimationFrame(frame);
  }, [take, beatsPerBar]);

  return (
    <>
      <div className="studio__now">
        <div>
          <p ref={status} className="label" aria-live="polite" />
          <p ref={note} className="studio__note-name" data-quiet="">
            &nbsp;
          </p>
        </div>
        {take.beat() !== null && (
          <ol ref={dots} className="beats" aria-hidden="true">
            {Array.from({ length: beatsPerBar }, (_, i) => (
              <li key={i} />
            ))}
          </ol>
        )}
      </div>
      <LiveRoll take={take} beatsPerBar={beatsPerBar} />
      <div className="studio__actions">
        <button type="button" className="studio__primary" onClick={onDone}>
          <StopIcon />
          Done
        </button>
      </div>
    </>
  );
}

interface WrittenProps {
  heard: Heard;
  title: string;
  from: 'voice' | 'file';
  meter: Meter;
  context: AudioContext;
  onMeter: (meter: Meter) => void;
  onAdd: (song: Song) => void;
  onAgain: () => void;
}

/** The tune written out: its notes on the roll, played on an instrument (with the voice under it, if wanted), its score, and the way into the library */
function Written({ heard, title, from, meter, context, onMeter, onAdd, onAgain }: WrittenProps) {
  const [instrument, setInstrument] = useState<InstrumentName>('piano');
  const [octave, setOctave] = useState(0);
  const [withVoice, setWithVoice] = useState(false);
  const [playing, setPlaying] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const jukebox = useMemo(() => new Jukebox({ context }), [context]);
  const voice = useRef<AudioBufferSourceNode | null>(null);

  const result = useMemo(
    () => transcribe(heard.frames, heard.click ? { bpm: heard.click.bpm, start: heard.click.downbeat, meter } : { meter }),
    [heard, meter],
  );
  const part = useMemo(() => transpose(result.part, 12 * octave), [result, octave]);
  const score = useMemo(() => formatMelody(part, meter, result.key), [part, meter, result.key]);
  const song = useMemo<Song>(
    () =>
      defineSong({
        title,
        description: `${from === 'voice' ? 'Sung into the microphone' : 'From a recording'}, written out by ear in ${result.key}.`,
        bpm: Math.round(result.bpm * 10) / 10,
        meter,
        loop: false,
        tracks: [{ name: 'Melody', instrument, part: score }],
      }),
    [title, from, result, meter, instrument, score],
  );

  const stop = () => {
    jukebox.stop(0.05);
    voice.current?.stop();
    voice.current = null;
    setPlaying(null);
  };
  const play = async () => {
    voice.current?.stop();
    const playback = await jukebox.play(song, { fadeIn: 0.01, fadeOut: 0.05 });
    if (!playback) return;
    if (withVoice) {
      // The recording from the moment the written part starts, under the notes
      const source = new AudioBufferSourceNode(context, { buffer: heard.audio });
      source.connect(new GainNode(context, { gain: 0.8 })).connect(context.destination);
      source.start(playback.startTime + Math.max(0, -result.start), Math.max(0, result.start));
      voice.current = source;
    }
    setPlaying(playback.startTime);
    void playback.finished.then(() => setPlaying((current) => (current === playback.startTime ? null : current)));
  };
  // A new instrument, octave or voice setting is heard at once: the tune starts again with it
  const replay = useRef(play);
  replay.current = play;
  // (Only a change of song or voice restarts it: the start of playback itself must not)
  useEffect(() => {
    if (playing !== null) void replay.current();
  }, [song, withVoice]);
  useEffect(() => () => jukebox.stop(0), [jukebox]);

  const playhead = useMemo(() => (playing === null ? null : () => (context.currentTime - playing) / (15 / song.bpm)), [playing, context, song.bpm]);

  if (!result.part.notes.length) {
    return (
      <>
        <h2 className="studio__title">No tune heard</h2>
        <p className="studio__lede">{from === 'voice' ? 'Sing a little louder, or closer to the microphone, and try again.' : 'The recording needs a clear melody, one note at a time.'}</p>
        <div className="studio__actions">
          <button type="button" className="studio__primary" onClick={onAgain}>
            Try again
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <h2 className="studio__title">{title}</h2>
      <p className="studio__meta label">
        <span>{Math.round(result.bpm)} BPM</span>
        <span>{result.key}</span>
        <span>{plural(result.part.notes.length, 'note')}</span>
      </p>
      <ScoreRoll part={part} meter={meter} bpm={result.bpm} start={result.start} frames={heard.frames} transpose={12 * octave} playhead={playhead} />
      <div className="studio__transport">
        <IconButton className="play-button play-button--large" label={playing !== null ? 'Stop' : 'Play the tune'} onClick={() => (playing !== null ? stop() : void play())}>
          {playing !== null ? <StopIcon /> : <PlayIcon />}
        </IconButton>
        <div className="chips" role="group" aria-label="Instrument">
          {INSTRUMENTS.map(([name, label]) => (
            <button key={name} type="button" className="chip" aria-pressed={instrument === name} onClick={() => setInstrument(name)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="studio__settings">
        <Setting label="Octave">
          <Stepper value={octave} min={-2} max={2} step={1} format={(v) => (v > 0 ? `+${v}` : String(v))} onChange={setOctave} label="Octave" />
        </Setting>
        <Setting label="Meter">
          <Choice options={METERS.map((m) => [m, String(m)])} value={meter} onChange={onMeter} label="Meter" />
        </Setting>
        <Setting label="Your voice">
          <Choice options={[[false, 'Off'], [true, 'Under it']]} value={withVoice} onChange={setWithVoice} label="Play your voice under the tune" />
        </Setting>
      </div>
      <section className="score" aria-label="Score">
        <div className="score__head">
          <h3 className="label">Score</h3>
          <button
            type="button"
            className="studio__link"
            onClick={() =>
              void navigator.clipboard.writeText(score).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              })
            }
          >
            <CopyIcon />
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="score__text">
          {score
            .split('|')
            .map((bar) => bar.trim())
            .filter(Boolean)
            .map((bar, i) => (
              <span key={i} className="score__bar">
                {bar}
              </span>
            ))}
        </p>
      </section>
      <div className="studio__actions">
        <button
          type="button"
          className="studio__primary"
          onClick={() => {
            stop();
            onAdd(song);
          }}
        >
          Add to Your songs
        </button>
        <button
          type="button"
          className="studio__secondary"
          onClick={() => {
            stop();
            onAgain();
          }}
        >
          <MicIcon />
          Sing again
        </button>
      </div>
    </>
  );
}

function Setting({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="setting">
      <span className="label">{label}</span>
      {children}
    </div>
  );
}

/** A row of mutually exclusive buttons */
function Choice<T>({ options, value, onChange, label }: { options: [T, string][]; value: T; onChange: (value: T) => void; label: string }) {
  return (
    <div className="choice" role="group" aria-label={label}>
      {options.map(([option, text]) => (
        <button key={text} type="button" aria-pressed={option === value} onClick={() => onChange(option)}>
          {text}
        </button>
      ))}
    </div>
  );
}

interface StepperProps {
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  disabled?: boolean;
  format?: (value: number) => string;
  onChange: (value: number) => void;
  label: string;
}

/** A number with a button either side */
function Stepper({ value, min, max, step, unit, disabled, format = String, onChange, label }: StepperProps) {
  return (
    <div className="stepper" role="group" aria-label={label} aria-disabled={disabled || undefined}>
      <button type="button" aria-label={`Lower ${label.toLowerCase()}`} disabled={disabled || value <= min} onClick={() => onChange(Math.max(min, value - step))}>
        −
      </button>
      <output>
        {format(value)}
        {unit && <span className="stepper__unit">{unit}</span>}
      </output>
      <button type="button" aria-label={`Raise ${label.toLowerCase()}`} disabled={disabled || value >= max} onClick={() => onChange(Math.min(max, value + step))}>
        +
      </button>
    </div>
  );
}
