// Polyphon: music for the browser, written as code.
//
//   Write    melody, rhythm, chords, pad, arpeggio, bassline, roots, strum, and the part transforms
//   Declare  defineSong: tempo, room, tracks (instrument + part), mixing and mastering
//   Play     Jukebox: crossfades, preloading, ducking, pause and seek
//   Export   renderSong + encodeWav
//   Import   songFromMidi, and transcribe for a sung melody
//   Extend   registerInstrument

export { melody, rhythm, type RhythmOptions } from './notation/melody.ts';
export { formatMelody } from './notation/format.ts';
export { chords, chordsDuration, pad, arpeggio, roots, bassline, strum, type Chord, type PadOptions, type ArpeggioOptions, type RootsOptions, type BasslineOptions, type StrumOptions } from './notation/harmony.ts';
export { sequence, stack, repeat, rest, transpose, mapPitch, scaleVelocity, slice, pedal } from './notation/transform.ts';
export { stepsPerBar, VELOCITY, type Note, type Part, type Meter } from './notation/part.ts';
export { midi, frequency, noteName, parseChord, voiceChord, scaleDegree, remapToMode, romanChord, MODES, type Pitch, type Mode, type ChordInfo, type VoicingOptions } from './theory.ts';

export { defineSong, songDuration, DEFAULT_REVERB, type Song, type Track, type Reverb, type Delay, type Master, type Duck, type Sweep, type Silence } from './song.ts';
export { tempoClock, type TempoChange, type TempoClock } from './tempo.ts';

export { Jukebox, type JukeboxOptions, type JukeboxState, type PlayOptions, type DuckOptions, type SongSource } from './engine/jukebox.ts';
export { Playback, type PlaybackOptions, type PlaybackTrack, type SongPosition } from './engine/playback.ts';
export { prepareSong, prepareSongSync } from './engine/prepare.ts';
export { renderSong, encodeWav, type RenderOptions } from './engine/render.ts';
export { compileSection, type CompiledSection, type ScheduledNote } from './engine/compile.ts';
export { songFromMidi, type MidiImportOptions } from './midi.ts';
export { PitchTracker, transcribe, type PitchFrame, type TranscribeOptions, type Transcription } from './transcribe.ts';

export { registerInstrument, instrumentNames, type InstrumentName, type CustomInstrument, type CustomSampledInstrument, type CustomSynthInstrument, type SynthNote } from './instruments/registry.ts';
