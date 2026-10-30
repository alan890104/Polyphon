# Polyphon

**Music for the browser, written as code.** A score notation, a synthesized orchestra of 103 instruments and a scheduler, on top of the Web Audio API. There are no audio files: every note is computed in the browser.

[繁體中文](README.zh-TW.md)

```ts
import { Jukebox, bassline, chords, defineSong, melody, pad, rhythm } from 'polyphon';

const harmony = chords('C | Am | F | G');

const theme = defineSong({
  title: 'Morning Market',
  bpm: 112,
  tracks: [
    { instrument: 'marimba', part: 'E5:2 G5:2 C6:4 B5:2 G5:2 E5:4 | A5:4 G5:2 E5:2 C5:8 | F5:2 A5:2 C6:4 A5:2 F5:2 D5:4 | G5:6 F5:2 E5:4 D5:4 |' },
    { instrument: 'strPad', part: pad(harmony, { center: 'C4', velocity: 0.4 }), gain: 0.6 },
    { instrument: 'pizzBass', part: bassline(harmony, 'x...x.x.x...x.x.', '1 5 8 5') },
    { instrument: 'kick', part: rhythm('X.......x.......') },
  ],
});

const music = new Jukebox();
music.play(theme); // starts on the first click or key press if the browser needs a gesture
```

Polyphon grew out of the soundtrack of [Eldor](https://github.com/alan890104/eldor), a creature-battle RPG whose 46 pieces are included here as examples.

## What it does

- **Notation that reads like music.** Melodies are short strings (`'E5:4 D5:2 C5:2 |'`), drum patterns are grids (`'X...x...'`), harmony is chord symbols (`'Am7 | D7 | Gmaj7'`). Pads, arpeggios, bass lines and strums grow out of a progression. Everything produces plain data, so you can also write notes yourself.
- **An orchestra with no samples.** Pianos and plucked strings are modelled physically, bowed strings are rendered player by player, and winds, brass, choirs and synths are synthesized live. Each sampled note is computed once and cached, so playback costs almost nothing.
- **A jukebox for games.** Crossfades between songs, preloading, pause, resume and seek, ducking under sound effects, intros that lead into loops, and the browser's audio unlock handled for you.
- **Import and export.** Load Standard MIDI Files with `songFromMidi`; render any song to a WAV with `renderSong` and `encodeWav`.
- **A listening room.** `npm run dev` opens a Spotify-style player with every example, a per-track mixer and a visualizer.

## Install

```bash
npm install github:alan890104/polyphon
```

TypeScript types are included. Polyphon has no runtime dependencies.

## Writing music

Time is counted in **steps**: one step is a sixteenth note, so a quarter note is 4 steps and a 4/4 bar is 16.

### Melodies

```ts
melody('E5:4 D5:2 C5:2 | B4:8 r:8 |')
```

| Write | Means |
| --- | --- |
| `E5:4` | note E5, 4 steps long (a quarter note) |
| `E5 D5` | leave out the length to reuse the previous one |
| `r:8` or `.` | a rest |
| `R` | a whole bar of rest |
| `\|` | bar line: each bar's length is checked, and a mistake throws with the bar number |
| `C4+E4+G4:16` | a chord |
| `!E5` / `?E5` | accent / ghost note |
| `E5:4>` | glide into the next note (instruments that can glide) |
| `E5:4/3` | fractional length: triplet eighths are `4/3` |
| `(E5:2 D5:2)*4` | repeat a group |

Pass a meter for other time signatures: `melody('G4:6 A4:2 B4:4 |', '3/4')`. A melody string can also be used directly as a track's `part`; it is then read in the song's meter.

### Rhythms

```ts
rhythm('X...x...X..xx...')             // X accent, x normal, o soft, . or - rest
rhythm('x.x.x.x.', { pitch: 'G2' })    // every hit on one pitch
rhythm('x.x.', { step: 2 })            // each character lasts 2 steps
```

### Harmony

```ts
const harmony = chords('Am | F | C G | E7');   // the chords in a bar share it equally
chords('Dm:12 A7:4 | %');                      // explicit lengths; % holds the previous chord another bar
```

Chord symbols: major, `m`, `dim`, `aug`, `sus2`, `sus4`, `5`, `6`, `m6`, `7`, `maj7`, `m7`, `mmaj7`, `m7b5`, `dim7`, `7sus4`, `add9`, `madd9`, `9`, `maj9`, `m9`, `7b9`, `7#9`, `m11`, `11`, `maj7s11`, `6/9`, `q` and `q4` (stacked fourths), and slash basses (`C/E`).

From a progression:

| Function | Makes |
| --- | --- |
| `pad(harmony, { center, size, velocity, gap })` | sustained chords, voiced to move as little as possible |
| `arpeggio(harmony, '0 1 2 1', { step, center, size, velocity, accent })` | broken chords: digits pick chord tones from the bottom (past the top they climb an octave), `.` rests, `-` holds |
| `bassline(harmony, 'x...x.x.', '1 5 8 5', { register, velocity })` | a bass line: the rhythm repeats every bar, and the line lists scale degrees (`1 3 5 8 -8 b7 7 2 4 6 b2 -5 -4`) |
| `roots(harmony, { register, fifth, velocity })` | one long bass note per chord, optionally with an open fifth |
| `strum(harmony, 'x.x-', { center, size, spread, velocity })` | strummed chords |

`center` and `register` take a note name (`'C4'`) or a MIDI number.

### Combining parts

| Function | Does |
| --- | --- |
| `sequence(a, b, ...)` | one after another (strings are read as 4/4 melodies) |
| `stack(a, b, ...)` | at the same time |
| `repeat(part, n)` | n times in a row |
| `rest(bars, meter?)` | silence |
| `transpose(part, semitones)` | shift pitches |
| `mapPitch(part, fn)` | rewrite pitches (for example `remapToMode`) |
| `scaleVelocity(part, factor)` | louder or softer |
| `slice(part, from, to)` | cut out a stretch of steps |
| `pedal(part, changes)` | the sustain pedal: notes ring until the next change (every n steps, a list of steps, or each chord of a progression) or until the key is struck again |

Theory helpers: `midi('C#4')`, `frequency('A4')`, `noteName(61)`, `parseChord('F#m7b5')`, `voiceChord`, `scaleDegree('D4', 'dorian', 2)`, `remapToMode`, `romanChord('iv7', 'D4', 'aeolian')`, and `MODES` (ionian to locrian, harmonic and melodic minor, Phrygian dominant, Hungarian minor, double harmonic, pentatonics, whole tone, octatonic and more).

### Songs

```ts
defineSong({
  title: 'Night Waltz',
  description: 'A minor, 3/4',
  bpm: 84,
  meter: '3/4',              // default '4/4'
  swing: 0,                  // eighth-note swing 0-0.5; swing16 for sixteenths
  reverb: { size: 2.6, damp: 0.5, preDelay: 0.02, early: 0.3, mix: 1 },
  delay: { steps: 3, feedback: 0.3, tone: 2800, mix: 0.8 },  // tempo-synced ping-pong
  gain: 1,
  master: { warm: 2, cut: 1, trim: -1 },  // mastering EQ in dB
  intro: [/* tracks that play once */],
  tracks: [/* tracks that loop */],
  loop: true,                // false: play once (jingles, fanfares)
});
```

A section lasts as long as its longest track, rounded up to whole bars; shorter tracks repeat to fill it unless they set `repeat: false`.

A track:

| Field | Default | |
| --- | --- | --- |
| `instrument` | | a built-in name (autocompleted) or one you registered |
| `part` | | a part, or a melody string |
| `name` | the instrument | shown in mixers |
| `gain` | 1 | level |
| `pan` | 0 | -1 left to 1 right |
| `reverb` | 0.25 | send to the room |
| `delay` | 0 | send to the delay |
| `transpose` | 0 | semitones |
| `humanize` | 0.008 s (drums 0.003) | timing looseness |
| `params` | | instrument settings: `attack`, `release`, `bright`, `glide`, `ring`, `tune` and others |
| `repeat` | true | repeat to fill the section |

## Playing music

```ts
const music = new Jukebox({
  songs: {                                       // optional: songs to play by name
    town: () => import('./music/town.ts'),       // loaded and prepared on first use
    battle: battleSong,
  },
  volume: 0.8,
});

music.play('town');                       // crossfades from whatever was playing
music.preload('battle');                  // render its samples ahead of time
await music.play('battle', { fadeOut: 0.5, fadeIn: 0.05 });
music.duck(-10);                          // dip under a big sound effect, recover in 0.35 s
music.duck(-30, { attack: 0.12, hold: 4, release: 0.6 });
music.pause();
music.resume();
music.seek(30);
music.playOnce(victoryJingle);            // layered on top
music.stop();
```

`play` resolves with the `Playback` once the song starts, or `null` if another song was asked for first (`music.playback` is the current one). A `Playback` reports `position()`, `duration`, `introDuration` and `loopDuration`; its `tracks` can be muted one by one (`track.muted = true`) and expose an `output` node for meters; `finished` resolves when a song with an end has played. Pass `{ loops: n }` to `play` to end after n passes.

The Jukebox creates its `AudioContext` on first use and starts it on the first click, tap or key press. To share a context with your sound effects, pass `context` and `destination`.

## Instruments

| Family | Instruments |
| --- | --- |
| Keys | `piano` `softPiano` `epiano` `revPiano` `organ` `organFull` `accordion` |
| Plucked strings | `harp` `nylon` `steel` `lute` `dulcimer` `pizz` `pizzBass` |
| Mallets and bells | `kalimba` `marimba` `vibes` `glock` `celesta` `musicbox` `bell` `chime` `steelpan` |
| Bowed strings | `strings` `strPad` `violin` `cello` `celli` `contrabass` `fiddle` `morin` `spicc` |
| Woodwinds | `flute` `panflute` `ocarina` `whistle` `clarinet` `oboe` `bassoon` |
| Brass | `horn` `horns` `trumpet` `trumpets` `trombone` `tuba` `brassStab` |
| Voices | `choir` `choirOo` `choirO` `menChoir` `chant` `soprano` `throat` |
| Pads and drones | `warmPad` `glassPad` `darkPad` `airPad` `glass` `drone` |
| Bass and synths | `bass` `synthBass` `sub` `distBass` `synthLead` `powerGtr` `muteGtr` |
| Drums | `kick` `boom` `snare` `field` `rim` `clap` `hat` `ohat` `ride` `crash` `swell` `tom` `taiko` `timpani` `frame` `darbuka` |
| Percussion | `shaker` `tamb` `woodblock` `clave` `anvil` `gong` `chain` `snap` `brush` `drip` `thunder` `thunderclap` |
| Ambience and effects | `wind` `sea` `fire` `crickets` `rain` `void` `cave` `birds` `riser` |

How they are made:

- **Piano**: modal synthesis of every string (one to three per note, slightly detuned), with inharmonicity, stretched tuning, two-stage decay and frequency-dependent string loss; a hammer whose felt rounds off the treble; sympathetic resonance from the other strings; a soundboard, damper noise and a faint ring after release; velocity-dependent brightness; and the keyboard spread across the stereo field.
- **Plucked strings**: Karplus-Strong excited by a physically shaped pluck (the n-th harmonic ∝ sin(nπ·position)/n), with frequency-dependent string loss, an allpass for exact tuning and the resonances of the instrument's body (guitar, lute, harp, dulcimer, violin); bass plucks are additive.
- **Bowed strings**: every player in a section is rendered separately, with their own intonation, vibrato, bowing point and bow noise, through a body with dozens of resonances. The sustain loops seamlessly.
- **Mallets and bells**: modal synthesis with the partial ratios of the real bars, tines and tubes (church bells have hum, prime, tierce, quint and nominal; a tubular bell's pitch is heard from partials near 2 : 3 : 4), and the mallet's contact time rounding off the overtones of the high notes.
- **Winds, brass and voices**: live oscillators with harmonic tables, breath noise, formant filters (choirs sing vowels) and per-note vibrato.
- **Drums**: drumheads as circular-membrane modes that glide as the head settles, with the stick or beater's click; timpani tuned by the air in the kettle (modes near 1 : 1.5 : 2 : 2.5 : 3); cymbal washes that bloom upward after the strike and lose their highs first; velocity-dependent brightness; and random variants, so repeated hits never sound identical.
- **Rooms**: a procedural convolution reverb per song.

Your own instruments:

```ts
registerInstrument('beep', {
  play({ context, destination, time, duration, frequency, velocity }) {
    const osc = new OscillatorNode(context, { type: 'square', frequency });
    const amp = new GainNode(context, { gain: velocity * 0.2 });
    osc.connect(amp).connect(destination);
    osc.start(time);
    osc.stop(time + duration);
  },
});

registerInstrument('myBell', {
  render: (sampleRate, midi) => renderBell(sampleRate, midi), // a Float32Array, computed once per pitch
  sustain: 'ring',
});
```

## MIDI and audio files

```ts
const song = songFromMidi(await file.arrayBuffer(), { title: file.name });
music.play(song);
```

`songFromMidi` keeps tempo changes in real time and reads the time signature, the sustain pedal, volume and pan. General MIDI programs pick instruments from the orchestra, and channel 10 becomes the drum kit.

```ts
const buffer = await renderSong(song, { loops: 1 });  // OfflineAudioContext, faster than real time
const wav = encodeWav(buffer);                        // 16-bit PCM
```

## The listening room

```bash
npm install
npm run dev
```

The player lists every example song (the Eldor soundtrack, Beethoven's Moonlight Sonata and a few short demos), with a mixer to mute or solo tracks, a visualizer, WAV download and MIDI import. MIDI files you import stay in your browser.

## Development

```bash
npm test             # notation, theory, MIDI import and every example song (Node, no browser)
npm run typecheck
npm run build        # the library, to dist/
npm run build:player # the listening room, to player/dist/
```

Node 22.18 or later runs the TypeScript sources directly.

## Credits

- The Eldor soundtrack (`examples/eldor`) was composed for [Eldor](https://github.com/alan890104/eldor).
- The Moonlight Sonata example was checked against the [Mutopia Project](https://www.mutopiaproject.org) edition (the music is public domain; the edition is licensed CC BY-SA 2.5).
- The piano's string loss follows A. Chaigne and A. Askenfelt, *Numerical simulations of piano strings* (1994).

## License

MIT
