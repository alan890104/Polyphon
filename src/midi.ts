// Read Standard MIDI Files into songs: notes, tempo changes, time signature, sustain pedal, volume and pan.
// General MIDI programs pick instruments from the built-in orchestra; channel 10 is the drum kit.

import type { BuiltInInstrument } from './instruments/builtin.ts';
import type { Note } from './notation/part.ts';
import type { Song, Track } from './song.ts';

export interface MidiImportOptions {
  /** Song title (default: the file's first track name, or 'Imported MIDI') */
  title?: string;
}

/**
 * Convert a Standard MIDI File (format 0 or 1) into a song that plays once.
 * Tempo changes are kept exactly: every event is placed by its real time, measured against the opening tempo.
 *
 * @example
 * const song = songFromMidi(await file.arrayBuffer(), { title: file.name });
 * jukebox.play(song);
 */
export function songFromMidi(data: ArrayBuffer | Uint8Array, options: MidiImportOptions = {}): Song {
  const file = parseMidi(data instanceof Uint8Array ? data : new Uint8Array(data));
  const tempos = file.tracks.flatMap((t) => t.events.filter((e) => e.kind === 'tempo')).sort((a, b) => a.tick - b.tick);
  const clock = tempoMap(tempos, file.ppq);
  const bpm = tempos.length && tempos[0].tick === 0 ? 60e6 / tempos[0].value : 120;
  const step = (tick: number) => clock(tick) / (60 / bpm / 4);
  const signature = file.tracks.flatMap((t) => t.events).find((e) => e.kind === 'meter');

  const groups = new Map<string, { name: string; instrument: BuiltInInstrument; gain: number; pan: number; notes: Note[] }>();
  let end = 0;
  file.tracks.forEach((track, ti) => {
    const program = new Array<number>(16).fill(0);
    const volume = new Array<number | undefined>(16);
    const pan = new Array<number | undefined>(16);
    const pedal = new Array<boolean>(16).fill(false);
    const sounding = new Map<string, { tick: number; velocity: number; program: number }[]>();
    const held = new Map<number, { key: string; start: { tick: number; velocity: number; program: number } }[]>();
    const finish = (key: string, start: { tick: number; velocity: number; program: number }, tick: number) => {
      const [channel, pitch] = key.split('|').map(Number);
      const drum = channel === 9 ? DRUMS[pitch] : undefined;
      if (channel === 9 && !drum) return;
      const instrument = drum ? drum[0] : GM_PROGRAMS[start.program];
      const id = `${ti}|${channel}|${instrument}`;
      let g = groups.get(id);
      if (!g) {
        const label = drum ? drum[1] : track.name || GM_NAMES[Math.floor(start.program / 8)];
        g = { name: label, instrument, gain: (volume[channel] ?? 100) / 100, pan: ((pan[channel] ?? 64) - 64) / 64, notes: [] };
        groups.set(id, g);
      }
      const time = step(start.tick);
      const duration = Math.max(0.25, step(tick) - time);
      g.notes.push({ time, duration, pitches: drum && !drum[2] ? [] : [pitch], velocity: start.velocity / 127 });
      end = Math.max(end, time + duration);
    };
    for (const e of track.events) {
      if (e.kind === 'program') program[e.channel] = e.value;
      else if (e.kind === 'control' && e.control === 7 && volume[e.channel] === undefined) volume[e.channel] = e.value;
      else if (e.kind === 'control' && e.control === 10 && pan[e.channel] === undefined) pan[e.channel] = e.value;
      else if (e.kind === 'control' && e.control === 64) {
        const down = e.value >= 64;
        if (pedal[e.channel] && !down) for (const h of held.get(e.channel)?.splice(0) ?? []) finish(h.key, h.start, e.tick);
        pedal[e.channel] = down;
      } else if (e.kind === 'noteOn') {
        const key = `${e.channel}|${e.pitch}`;
        // A key struck again while the pedal holds the old note: the old note ends here
        const h = held.get(e.channel);
        const i = h?.findIndex((x) => x.key === key) ?? -1;
        if (h && i >= 0) finish(key, h.splice(i, 1)[0].start, e.tick);
        const list = sounding.get(key) ?? [];
        list.push({ tick: e.tick, velocity: e.velocity, program: program[e.channel] });
        sounding.set(key, list);
      } else if (e.kind === 'noteOff') {
        const key = `${e.channel}|${e.pitch}`;
        const start = sounding.get(key)?.shift();
        if (!start) continue;
        if (pedal[e.channel] && e.channel !== 9) {
          const h = held.get(e.channel) ?? [];
          h.push({ key, start });
          held.set(e.channel, h);
        } else finish(key, start, e.tick);
      }
    }
    // Notes still sounding or held at the end of the track
    const last = track.events.length ? track.events[track.events.length - 1].tick : 0;
    for (const [key, list] of sounding) for (const start of list) finish(key, start, last);
    for (const h of held.values()) for (const x of h) finish(x.key, x.start, last);
  });

  const duration = Math.ceil(end);
  const noteCount = [...groups.values()].reduce((n, g) => n + g.notes.length, 0);
  const tracks: Track[] = [...groups.values()].map((g) => ({
    name: g.name,
    instrument: g.instrument,
    part: { notes: g.notes.sort((a, b) => a.time - b.time), duration },
    gain: g.gain,
    pan: g.pan,
    repeat: false,
  }));
  if (!tracks.length) throw new Error('The MIDI file has no notes');
  const title = options.title ?? (file.tracks.find((t) => t.name)?.name || 'Imported MIDI');
  return {
    title,
    description: `Imported from MIDI: ${tracks.length} tracks, ${noteCount} notes.`,
    bpm: Math.round(bpm * 100) / 100,
    meter: signature ? (`${signature.value}/${signature.denominator}` as const) : 16,
    loop: false,
    tracks,
  };
}

// ───────────────────────── Reading the file ─────────────────────────

type MidiEvent =
  | { kind: 'noteOn' | 'noteOff'; tick: number; channel: number; pitch: number; velocity: number }
  | { kind: 'control'; tick: number; channel: number; control: number; value: number }
  | { kind: 'program'; tick: number; channel: number; value: number }
  | { kind: 'tempo'; tick: number; value: number }
  | { kind: 'meter'; tick: number; value: number; denominator: number };

interface MidiFile {
  ppq: number;
  tracks: { name: string; events: MidiEvent[] }[];
}

function parseMidi(b: Uint8Array): MidiFile {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const text = (at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n));
  if (text(0, 4) !== 'MThd') throw new Error('Not a MIDI file');
  const count = view.getUint16(10);
  const ppq = view.getUint16(12);
  if (ppq & 0x8000) throw new Error('SMPTE-timed MIDI files are not supported');
  const tracks: MidiFile['tracks'] = [];
  let at = 8 + view.getUint32(4);
  for (let t = 0; t < count && at < b.length; t++) {
    const length = view.getUint32(at + 4);
    if (text(at, 4) === 'MTrk') tracks.push(parseTrack(b, at + 8, at + 8 + length));
    at += 8 + length;
  }
  return { ppq, tracks };
}

function parseTrack(b: Uint8Array, from: number, to: number): MidiFile['tracks'][number] {
  const events: MidiEvent[] = [];
  let name = '';
  let i = from;
  let tick = 0;
  let status = 0;
  const varLen = () => {
    let v = 0;
    for (;;) {
      const c = b[i++];
      v = (v << 7) | (c & 0x7f);
      if (!(c & 0x80)) return v;
    }
  };
  while (i < to) {
    tick += varLen();
    if (b[i] & 0x80) status = b[i++];
    if (status === 0xff) {
      const type = b[i++];
      const length = varLen();
      const d = b.subarray(i, i + length);
      if (type === 0x51) events.push({ kind: 'tempo', tick, value: (d[0] << 16) | (d[1] << 8) | d[2] });
      else if (type === 0x58) events.push({ kind: 'meter', tick, value: d[0], denominator: 2 ** d[1] });
      else if (type === 0x03 && !name) name = new TextDecoder().decode(d).trim();
      i += length;
      continue;
    }
    if (status === 0xf0 || status === 0xf7) {
      i += varLen();
      continue;
    }
    const channel = status & 0x0f;
    switch (status & 0xf0) {
      case 0x90:
      case 0x80: {
        const pitch = b[i++];
        const velocity = b[i++];
        events.push({ kind: (status & 0xf0) === 0x90 && velocity > 0 ? 'noteOn' : 'noteOff', tick, channel, pitch, velocity });
        break;
      }
      case 0xb0:
        events.push({ kind: 'control', tick, channel, control: b[i++], value: b[i++] });
        break;
      case 0xc0:
        events.push({ kind: 'program', tick, channel, value: b[i++] });
        break;
      case 0xd0:
        i += 1;
        break;
      default:
        i += 2;
    }
  }
  return { name, events };
}

/** Ticks → seconds, following every tempo change */
function tempoMap(tempos: MidiEvent[], ppq: number): (tick: number) => number {
  const points: { tick: number; seconds: number; perTick: number }[] = [{ tick: 0, seconds: 0, perTick: 0.5 / ppq }];
  for (const t of tempos) {
    if (t.kind !== 'tempo') continue;
    const last = points[points.length - 1];
    const seconds = last.seconds + (t.tick - last.tick) * last.perTick;
    points.push({ tick: t.tick, seconds, perTick: t.value / 1e6 / ppq });
  }
  return (tick) => {
    let p = points[0];
    for (const q of points) if (q.tick <= tick) p = q;
    return p.seconds + (tick - p.tick) * p.perTick;
  };
}

// ───────────────────────── General MIDI ─────────────────────────

/** Instrument for each of the 128 General MIDI programs, one family of eight per line */
const GM_PROGRAMS: BuiltInInstrument[] = [
  'piano', 'piano', 'piano', 'piano', 'epiano', 'epiano', 'dulcimer', 'piano',
  'celesta', 'glock', 'musicbox', 'vibes', 'marimba', 'marimba', 'chime', 'dulcimer',
  'organ', 'organ', 'organ', 'organFull', 'organ', 'accordion', 'accordion', 'accordion',
  'nylon', 'steel', 'steel', 'steel', 'muteGtr', 'powerGtr', 'powerGtr', 'steel',
  'pizzBass', 'bass', 'bass', 'bass', 'bass', 'bass', 'synthBass', 'synthBass',
  'violin', 'violin', 'cello', 'contrabass', 'strings', 'pizz', 'harp', 'timpani',
  'strings', 'strPad', 'strPad', 'strPad', 'choir', 'choirOo', 'choirO', 'brassStab',
  'trumpet', 'trombone', 'tuba', 'trumpet', 'horn', 'trumpets', 'trumpets', 'horns',
  'oboe', 'clarinet', 'clarinet', 'bassoon', 'oboe', 'oboe', 'bassoon', 'clarinet',
  'flute', 'flute', 'whistle', 'panflute', 'ocarina', 'panflute', 'whistle', 'ocarina',
  'synthLead', 'synthLead', 'synthLead', 'synthLead', 'synthLead', 'synthLead', 'synthLead', 'synthLead',
  'warmPad', 'warmPad', 'warmPad', 'choirOo', 'strPad', 'glassPad', 'airPad', 'darkPad',
  'glassPad', 'glassPad', 'airPad', 'glassPad', 'glassPad', 'darkPad', 'airPad', 'glassPad',
  'lute', 'steel', 'lute', 'harp', 'kalimba', 'oboe', 'fiddle', 'oboe',
  'glock', 'woodblock', 'steelpan', 'woodblock', 'taiko', 'tom', 'tom', 'swell',
  'glassPad', 'glassPad', 'glassPad', 'glassPad', 'glassPad', 'glassPad', 'glassPad', 'glassPad',
];

/** Display names of the General MIDI families (eight programs each) */
const GM_NAMES = ['Piano', 'Chromatic percussion', 'Organ', 'Guitar', 'Bass', 'Strings', 'Ensemble', 'Brass', 'Reed', 'Pipe', 'Synth lead', 'Synth pad', 'Synth effects', 'Ethnic', 'Percussive', 'Sound effects'];

/** General MIDI drum keys: [instrument, mixer name, keeps its pitch] */
const DRUMS: Record<number, [BuiltInInstrument, string, boolean]> = {
  35: ['kick', 'Kick', false],
  36: ['kick', 'Kick', false],
  37: ['rim', 'Rim', false],
  38: ['snare', 'Snare', false],
  39: ['clap', 'Clap', false],
  40: ['snare', 'Snare', false],
  41: ['tom', 'Toms', true],
  42: ['hat', 'Hi-hat', false],
  43: ['tom', 'Toms', true],
  44: ['hat', 'Hi-hat', false],
  45: ['tom', 'Toms', true],
  46: ['ohat', 'Open hi-hat', false],
  47: ['tom', 'Toms', true],
  48: ['tom', 'Toms', true],
  49: ['crash', 'Crash', false],
  50: ['tom', 'Toms', true],
  51: ['ride', 'Ride', false],
  52: ['crash', 'Crash', false],
  53: ['ride', 'Ride', false],
  54: ['tamb', 'Tambourine', false],
  55: ['crash', 'Crash', false],
  56: ['woodblock', 'Cowbell', true],
  57: ['crash', 'Crash', false],
  58: ['shaker', 'Shaker', false],
  59: ['ride', 'Ride', false],
  60: ['darbuka', 'Bongos', true],
  61: ['darbuka', 'Bongos', true],
  62: ['darbuka', 'Congas', true],
  63: ['darbuka', 'Congas', true],
  64: ['darbuka', 'Congas', true],
  65: ['tom', 'Timbales', true],
  66: ['tom', 'Timbales', true],
  67: ['woodblock', 'Agogo', true],
  68: ['woodblock', 'Agogo', true],
  69: ['shaker', 'Shaker', false],
  70: ['shaker', 'Shaker', false],
  73: ['shaker', 'Shaker', false],
  74: ['shaker', 'Shaker', false],
  75: ['clave', 'Claves', false],
  76: ['woodblock', 'Wood block', true],
  77: ['woodblock', 'Wood block', true],
  78: ['darbuka', 'Cuica', true],
  79: ['darbuka', 'Cuica', true],
};
