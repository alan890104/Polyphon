# Polyphon

https://github.com/user-attachments/assets/da754130-8c39-4e8d-962d-78e3fc75a40d

<p align="center"><em>Por una Cabeza</em> as electro tango. Every note is synthesized by Polyphon; nothing was recorded.</p>

**Music for the browser, written as code.** A score notation, a synthesized orchestra of 120 instruments and a scheduler, on top of the Web Audio API. There are no audio files: every note is computed in the browser.

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

Polyphon grew out of the music engine of [Eldor](https://github.com/alan890104/eldor), a creature-battle RPG.

## Listen

Every example is rendered by Polyphon itself; nothing here was recorded. Six of them, playing on their music-box discs:

https://github.com/user-attachments/assets/3dd6375e-73da-4b24-bd01-fde3ada79b8c

https://github.com/user-attachments/assets/e0cf3e6e-2149-4503-a2e3-3facc73d2753

https://github.com/user-attachments/assets/7bf0cd1c-3810-4a21-96bb-052546b22d0d

https://github.com/user-attachments/assets/32e30b01-1e8a-49c2-b495-7dad8942bd93

https://github.com/user-attachments/assets/b75ce45f-5b55-4657-b7ac-4200df6921b1

https://github.com/user-attachments/assets/2b1fafc0-cbc6-424c-b731-b079f3d0606e

And every one as an MP3:

| Song | What you hear | |
| --- | --- | --- |
| Morning Market | An original market tune in C major: marimba over pizzicato bass, shaker and a soft string bed | [▶ 0:24](docs/audio/morning-market.mp3) |
| Night Waltz | An original waltz in A minor: piano over harp arpeggios, a string pad and cellos | [▶ 0:20](docs/audio/night-waltz.mp3) |
| After Midnight | An original piano ballad in B minor over a slow R&B groove, with strings and a violin | [▶ 1:42](docs/audio/after-midnight.mp3) |
| Neon Tide | An original progressive-house track in F minor: build, pumping supersaw drop, piano breakdown, final drop | [▶ 2:35](docs/audio/neon-tide.mp3) |
| Por una Cabeza (Electro Tango) | Gardel's tango remade as electro tango: his refrain on a solo violin and strings over a kick on tango's 3-3-2, a new strain in A minor for a solo cello, a build, a dead stop, the last refrains in octaves | [▶ 1:44](docs/audio/por-una-cabeza.mp3) |
| Moonlight Sonata | Beethoven, the opening of the first movement, on the modelled piano | [▶ 0:43](docs/audio/moonlight.mp3) |
| Canon in D | Pachelbel, complete: three violins in canon over a cello ground | [▶ 4:08](docs/audio/canon.mp3) |
| Canon in D Minor | The same canon moved into D minor, written as a transformation of the original | [▶ 4:08](docs/audio/canon-minor.mp3) |
| Symphony No. 5 | Beethoven, the exposition of the first movement, for full orchestra | [▶ 1:19](docs/audio/symphony5.mp3) |
| Carmen: Prelude | Bizet, the Prelude to Act 1, complete, for full orchestra: the procession, the Toreador's song, the fate motif | [▶ 3:36](docs/audio/carmen.mp3) |
| Carmen: Habanera | Bizet, the opening of Carmen's entrance aria: her line on a solo violin over the cellos' habanera in D minor, then the chorus in D major | [▶ 0:50](docs/audio/habanera.mp3) |

## What it does

- **Notation that reads like music.** Melodies are short strings (`'E5:4 D5:2 C5:2 |'`), drum patterns are grids (`'X...x...'`), harmony is chord symbols (`'Am7 | D7 | Gmaj7'`). Pads, arpeggios, bass lines and strums grow out of a progression. Everything produces plain data, so you can also write notes yourself.
- **An orchestra with no samples.** Pianos and plucked strings are modelled physically, bowed strings are rendered player by player, and winds, brass, choirs and synths are synthesized live. Each sampled note is computed once and cached, so playback costs almost nothing.
- **A jukebox for games.** Crossfades between songs, preloading, pause, resume and seek, ducking under sound effects, intros that lead into loops, and the browser's audio unlock handled for you.
- **Import and export.** Load Standard MIDI Files with `songFromMidi`, or write down a hummed melody with `transcribe`; render any song to a WAV with `renderSong` and `encodeWav`.
- **A listening room.** `npm run dev` opens a player with every example and a per-track mixer; each song is drawn from its own notes as a perforated disc, like a polyphon's, that turns as it plays.

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
| `G4:8~ \| G4:4` | tie: one note held across the bar line |
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
  bpm: 84,                   // the tempo it starts at
  tempo: [{ bar: 33, bpm: 72, over: 4 }],  // changes of tempo, below
  silences: [{ bar: 32.75, beats: 1 }],    // dead stops, below
  meter: '3/4',              // default '4/4'
  swing: 0,                  // eighth-note swing 0-0.5; swing16 for sixteenths
  reverb: { size: 2.6, damp: 0.5, preDelay: 0.02, early: 0.3, mix: 1 },
  delay: { steps: 3, feedback: 0.3, tone: 2800, mix: 0.8 },  // tempo-synced ping-pong
  gain: 1,
  master: { warm: 2, cut: 1, trim: -1 },  // mastering EQ in dB; glue and loud below
  intro: [/* tracks that play once */],
  tracks: [/* tracks that loop */],
  loop: true,                // false: play once (jingles, fanfares)
});
```

A section lasts as long as its longest track, rounded up to whole bars; shorter tracks repeat to fill it unless they set `repeat: false`.

The tempo can change along the way, at once or gradually. Bars count from 1 at the start of the song, the intro's first; a looping body plays its changes again on every pass.

```ts
tempo: [
  { bar: 17, bpm: 66 },           // a new tempo from bar 17
  { bar: 29, bpm: 50, over: 4 },  // ritardando: down to 50 across bars 29 to 32
  { bar: 33, bpm: 84 },           // a tempo
  { bar: 40.5, bpm: 40 },         // the second half of bar 40, held back: a fermata
  { bar: 41, bpm: 84 },
]
```

`tempoClock(song)` turns positions in the score into seconds and back, for anything that has to keep time with the music.

A silence is a dead stop: from its bar, counted the same way, everything falls silent for its beats, the reverb and delay tails too, as if the room were switched off, and the music crashes back in at full level. Leaving the notes out makes a rest; a silence makes the beat of nothing before a drop.

```ts
silences: [{ bar: 32.75, beats: 1 }],  // the last beat of bar 32
```

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
| `duck` | | pump under another track's hits: its name (`'Kick'`), or `{ by, depth, release }` |
| `lowpass` | | low-pass cutoff in Hz, or a sweep `{ step: Hz }` |
| `highpass` | | high-pass cutoff in Hz, or a sweep |
| `transpose` | 0 | semitones |
| `humanize` | 0.008 s (drums 0.003) | timing looseness |
| `params` | | instrument settings: `attack`, `release`, `bright`, `glide`, `ring`, `tune` and others |
| `repeat` | true | repeat to fill the section |

### Mixing electronic music

```ts
const harmony = chords('Fm | Db | Ab | Eb');

defineSong({
  title: 'Drop',
  bpm: 128,
  master: { glue: 0.5, loud: 8 },
  tracks: [
    { name: 'Kick', instrument: 'bigKick', part: rhythm('X...'.repeat(64), { pitch: 'F1' }) },
    { name: 'Chords', instrument: 'supersaw', part: pad(harmony, { center: 'Ab4' }), duck: 'Kick' },
    { name: 'Sub', instrument: 'sub', part: roots(harmony, { register: 'F1' }), duck: { by: 'Kick', depth: 0.9 } },
    { name: 'Pluck', instrument: 'pluck', part: arpeggio(harmony, '0 1 2 3', { center: 'C5' }), lowpass: { 0: 400, 128: 400, 256: 18000 } },
  ],
});
```

- **Sidechain pumping.** `duck: 'Kick'` dips a track at every hit of the track called Kick in the same section, then swells it back: the pumping of house and EDM. `depth` is how far it dips (0-1, default 0.7) and `release` how many steps it takes to come back (default 4, a beat). It follows the notes, not the sound, so it stays exact through seeks and loops, and a muted or silent kick (`gain: 0`) still drives it.
- **Filter sweeps.** `lowpass` and `highpass` take a cutoff in Hz, or breakpoints `{ step: Hz }` counted from the start of the section. The cutoff glides between them evenly in pitch and holds before the first and after the last, so the pluck above stays dark for eight bars and opens over the next eight. Each loop starts the sweep again.
- **Mastering.** `glue` (0-1) is bus compression that holds the mix together. `loud` masters the song loud: that many dB pushed into a brickwall limiter that keeps the peaks under -1 dBFS, between the samples too (EDM: about 6 to 10). A song with `loud` skips the gentle limiter other songs share, so it is not compressed twice.

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
| Woodwinds | `flute` `panflute` `ocarina` `whistle` `clarinet` `oboe` `bassoon` `sax` `tenorSax` |
| Brass | `horn` `horns` `trumpet` `trumpets` `trombone` `tuba` `brassStab` |
| Voices | `choir` `choirOo` `choirO` `menChoir` `chant` `soprano` `throat` |
| Pads and drones | `warmPad` `glassPad` `darkPad` `airPad` `glass` `drone` |
| Synths and guitars | `supersaw` `synthLead` `pluck` `powerGtr` `muteGtr` |
| Bass | `bass` `synthBass` `reese` `acid` `bass808` `sub` `distBass` |
| Drums | `kick` `boom` `snare` `field` `rim` `clap` `hat` `ohat` `ride` `crash` `swell` `tom` `taiko` `timpani` `frame` `darbuka` |
| Electronic drums | `kick808` `kick909` `bigKick` `snare909` `clap909` `hat909` `ohat909` |
| Percussion | `shaker` `tamb` `woodblock` `clave` `anvil` `triangle` `gong` `chain` `snap` `brush` `drip` `thunder` `thunderclap` |
| Ambience and effects | `wind` `sea` `fire` `crickets` `rain` `void` `cave` `birds` `riser` `downlifter` `impact` |

How they are made:

- **Piano**: modal synthesis of every string (one to three per note, slightly detuned), with inharmonicity, stretched tuning, two-stage decay and frequency-dependent string loss; a hammer whose felt rounds off the treble; sympathetic resonance from the other strings; a soundboard, damper noise and a faint ring after release; velocity-dependent brightness; and the keyboard spread across the stereo field.
- **Plucked strings**: Karplus-Strong excited by a physically shaped pluck (the n-th harmonic ∝ sin(nπ·position)/n), with frequency-dependent string loss, an allpass for exact tuning and the resonances of the instrument's body (guitar, lute, harp, dulcimer, violin); bass plucks are additive.
- **Bowed strings**: every player in a section is rendered separately, with their own intonation, vibrato, bowing point and bow noise, through a body of a hundred-odd resonances fitted to recordings of real violins, cellos and double basses, so the vibrato makes the upper partials flicker. The bowed corner is rounded at a partial number, so low strings are darker than high ones. The sustain loops seamlessly; spiccato notes ring on freely after the bow bounces off.
- **Mallets and bells**: modal synthesis with the partial ratios of the real bars, tines and tubes (church bells have hum, prime, tierce, quint and nominal; a tubular bell's pitch is heard from partials near 2 : 3 : 4), and the mallet's contact time rounding off the overtones of the high notes.
- **Winds and brass**: the lips, the reed or the air jet are modelled as a valve (a sine through a nonlinear curve), so the tone brightens with dynamics the way the real instruments do: a soft trumpet is mellow and a loud one blazes, the clarinet keeps mostly odd harmonics in its low register, and the saxophone growls when pushed. Bore and bell are filters and formants; section players enter a few milliseconds apart and sit a few cents off.
- **Voices**: formant filters (choirs sing vowels), breath noise and per-note vibrato.
- **Drums**: drumheads as circular-membrane modes that glide as the head settles, with the stick or beater's click; timpani tuned by the air in the kettle (modes near 1 : 1.5 : 2 : 2.5 : 3); cymbal washes that bloom upward after the strike and lose their highs first; velocity-dependent brightness; and random variants, so repeated hits never sound identical.
- **Synthesizers**: analog subtractive synthesis. The oscillators run free (each note starts them at a random point of their cycle, a cent or two off pitch) into a four-pole low-pass (24 dB/oct, like a transistor ladder) whose cutoff follows the keyboard and whose envelope opens further the harder a note is played. `supersaw` follows Adam Szabo's measurements of the Roland JP-8000 (seven saws on the original detune and mix curves, with a high-pass at the fundamental); `synthLead` is a Minimoog-style lead, `pluck` the trance arpeggio pluck, and `warmPad` and `darkPad` Juno-style chorused pads. `acid` is a TB-303 (accent with `!`, slide with `>`), `reese` a churning detuned bass and `bass808` a gliding 808; the basses stay mono below 120 Hz. `cut`, `q`, `env`, `detune`, `attack`, `release` and `glide` shape each voice.
- **Electronic drums**: modelled on Roland's drum machines and fitted to recordings. The 808 kick is a bridged-T resonator whose attack briefly raises its pitch; the 909 kick is an oscillator with a fast pitch envelope and a noise click; the clap is three noise bursts about 11 ms apart and a reverberant tail; the 909 hats are 6-bit, like the machine's memory, and a closed hat cuts off a ringing open one. `bigKick` is a modern layered EDM kick: a pitch-dive punch, a clipped sub and a top click. Give a kick a pitch to tune it to the song (`rhythm('X...X...X...X...', { pitch: 'F1' })`); `riser` and `downlifter` last as long as their note, so `melody('C4:128')` is an eight-bar build.
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

## MIDI, audio files and singing

```ts
const song = songFromMidi(await file.arrayBuffer(), { title: file.name });
music.play(song);
```

`songFromMidi` keeps the notes on the file's beat grid and its tempo changes as the song's own, and reads the time signature, the sustain pedal, volume and pan. General MIDI programs pick instruments from the orchestra, and channel 10 becomes the drum kit.

```ts
const buffer = await renderSong(song, { loops: 1 });  // OfflineAudioContext, faster than real time
const wav = encodeWav(buffer);                        // 16-bit PCM
```

A WAV is lossless but large, about 10 MB a minute. For an MP3 (about a seventh of that), hand the buffer to an MP3 encoder; the listening room does it with [lamejs](https://github.com/zhuker/lamejs) in a worker (`player/src/mp3.ts`), so the library itself needs none.

A melody sung or hummed one note at a time can be written down. `PitchTracker` follows the voice's pitch as audio arrives, from a microphone or a file, and `transcribe` puts what it heard on the beat grid:

```ts
const tracker = new PitchTracker(audio.sampleRate);
tracker.push(audio.getChannelData(0));
const { melody, bpm, key } = transcribe(tracker.frames);
// 'r:12 Bb4:4 | Bb4:3 C5 D5:2 D5:8 | A4:12 G4:4 | ...', 96.8, 'G minor'
```

It needs no trained model: a voice's pitch shows in the sound's own periodicity. A voice that sits sharp or flat, or drifts, is followed, and a note between two semitones takes the one in the key. Sung with a metronome (`{ bpm, start }`: its tempo and where its first bar begins), the notes fall on its beats; without one, the tempo and the downbeat are found from the notes themselves. A new note starts where the pitch moves, where the voice stops and starts again, or where the same note is struck anew, and a rest is written only for a clear silence. `formatMelody` writes any one-line part back as a melody string, spelled in its key.

## The listening room

```bash
npm install
npm run dev
```

The player lists every example song (Beethoven's Moonlight Sonata and Fifth Symphony, Pachelbel's Canon in D, the same canon moved into D minor, and a few short demos), with a mixer to mute or solo tracks, MP3 and WAV download and MIDI import. Every song's cover is its score: the notes punched into a disc, angle for time and radius for pitch, the tune in brass. While a song plays its disc turns under the comb and the perforations light up as they pass.

Press **F** (or the visualizer button) for the immersive view: full screen, the controls fade away while you listen. Pick a style (by default a disc music box in 3D, whose comb is plucked by each perforation as you hear its note while a lamp inside throws the notes onto the lid; or the turning disc ringed by its spectrum, falling notes onto a piano keyboard, spectrum, waveform, ridgeline, particles), a background (ink, the song's disc, aurora, starfield or a picture of your own; the music box has a room of its own) and a theme; the choice is remembered. The music box, falling notes and the disc follow the score itself, in time with what you hear. MIDI files you import stay in your browser.

**Hum a tune** (in the sidebar) to have a melody written out. Sing or hum on "da" into the microphone, with a click to keep time or at your own pace, or open a recording. The voice is drawn as it comes in; then the notes appear on a roll, played on the instrument you pick (with your voice under them, to compare), with the score ready to copy and a button that adds the tune to Your songs beside the MIDI files you import. Nothing you sing leaves the browser.

## Development

```bash
npm test             # notation, theory, MIDI import, transcription and every example song (Node, no browser)
npm run typecheck
npm run build        # the library, to dist/
npm run build:player # the listening room, to player/dist/
```

Node 22.18 or later runs the TypeScript sources directly.

## Credits

- The Moonlight Sonata example was checked against the [Mutopia Project](https://www.mutopiaproject.org) edition (the music is public domain; the edition is licensed CC BY-SA 2.5).
- The Fifth Symphony example was checked against the [Mutopia Project](https://www.mutopiaproject.org) edition (the music and the edition are both public domain).
- The Canon in D example was checked against the [Mutopia Project](https://www.mutopiaproject.org) edition (the music is public domain; the edition is licensed CC BY 4.0).
- The piano's string loss follows A. Chaigne and A. Askenfelt, *Numerical simulations of piano strings* (1994).
- The listening room's MP3 download uses [lamejs](https://github.com/zhuker/lamejs), a JavaScript port of [LAME](https://lame.sourceforge.io) (LGPL-3.0), loaded unmodified and in its own file, only when a song is downloaded.

## License

MIT
