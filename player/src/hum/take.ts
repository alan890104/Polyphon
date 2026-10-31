// One go at singing a tune in: the microphone, a metronome to keep time with (or none), and the voice fed to a pitch tracker as it
// arrives. Recordings opened from a file go through the same tracker.

import { PitchTracker, type PitchFrame } from 'polyphon';
import recorder from './recorder.worklet.ts?worker&url';

export interface TakeOptions {
  /** Count in one bar, then click every beat at this tempo; null to sing freely and find the tempo afterwards */
  bpm: number | null;
  beatsPerBar: number;
}

/** What a take or a file leaves to be written out */
export interface Heard {
  frames: PitchFrame[];
  /** The sound itself, to play back beside the notes; the frames' clock starts at its first sample */
  audio: AudioBuffer;
  /** The metronome's tempo and its first downbeat on the frames' clock, when there was one */
  click?: { bpm: number; downbeat: number };
}

const LOOKAHEAD = 0.2;

export class Take {
  readonly context: AudioContext;
  readonly tracker: PitchTracker;
  private readonly stream: MediaStream;
  private readonly source: MediaStreamAudioSourceNode;
  private readonly node: AudioWorkletNode;
  private readonly pieces: Float32Array<ArrayBuffer>[] = [];
  /** The audio clock's time at the first sample kept: the tracker's clock starts there */
  private origin: number | null = null;
  /** The audio clock's time when the take started (the first click, when there is a metronome) */
  private began = 0;
  private options: TakeOptions = { bpm: null, beatsPerBar: 4 };
  private scheduled = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private click: AudioBuffer;

  private constructor(context: AudioContext, stream: MediaStream, source: MediaStreamAudioSourceNode, node: AudioWorkletNode) {
    this.context = context;
    this.stream = stream;
    this.source = source;
    this.node = node;
    this.tracker = new PitchTracker(context.sampleRate);
    this.click = noise(context, 0.012);
    node.port.onmessage = ({ data }: MessageEvent<{ time: number; samples: Float32Array<ArrayBuffer> }>) => {
      if (data.time + data.samples.length / context.sampleRate < this.began) return;
      this.origin ??= data.time;
      this.pieces.push(data.samples);
      this.tracker.push(data.samples);
    };
  }

  /** Ask for the microphone. Rejects with a sentence for the person when it can't be had. */
  static async open(context: AudioContext): Promise<Take> {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('This page can’t reach a microphone: it needs a secure (https) address.');
    let stream: MediaStream;
    try {
      // The voice as it is: no echo cancelling, noise gating or automatic level, all of which bend pitch and timing
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
    } catch (error) {
      throw new Error(microphoneError(error));
    }
    await context.resume();
    await context.audioWorklet.addModule(recorder);
    const source = context.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(context, 'polyphon-recorder', { numberOfOutputs: 0 });
    return new Take(context, stream, source, node);
  }

  /** Start listening, after a bar of clicks when there is a metronome */
  start(options: TakeOptions): void {
    this.options = options;
    this.began = this.context.currentTime + 0.25;
    this.source.connect(this.node);
    if (options.bpm === null) return;
    this.scheduled = 0;
    const schedule = () => {
      const beat = 60 / options.bpm!;
      while (this.began + this.scheduled * beat < this.context.currentTime + LOOKAHEAD) {
        this.tick(this.began + this.scheduled * beat, this.scheduled % options.beatsPerBar === 0);
        this.scheduled++;
      }
    };
    schedule();
    this.timer = setInterval(schedule, 50);
  }

  /** Beats since bar 1, as heard now (negative through the count-in); null without a metronome */
  beat(): number | null {
    if (this.options.bpm === null) return null;
    const heard = this.context.currentTime - this.outputDelay();
    return (heard - this.began) / (60 / this.options.bpm) - this.options.beatsPerBar;
  }

  /** Seconds on the tracker's clock now (the frames lag a little behind it) */
  now(): number {
    return this.context.currentTime - (this.origin ?? this.began);
  }

  /** Where a beat (0 is bar 1's downbeat) lands on the tracker's clock, as a voice keeping time with it reaches the microphone */
  beatTime(beat: number): number | null {
    if (this.options.bpm === null) return null;
    const scheduled = this.began + (beat + this.options.beatsPerBar) * (60 / this.options.bpm);
    return scheduled + this.outputDelay() + this.inputDelay() - (this.origin ?? this.began);
  }

  /** Stop listening and clicking; what was heard */
  stop(): Heard {
    if (this.timer) clearInterval(this.timer);
    this.source.disconnect();
    const length = this.pieces.reduce((sum, p) => sum + p.length, 0);
    const audio = this.context.createBuffer(1, Math.max(1, length), this.context.sampleRate);
    let at = 0;
    for (const piece of this.pieces) {
      audio.copyToChannel(piece, 0, at);
      at += piece.length;
    }
    const { bpm } = this.options;
    return { frames: this.tracker.frames, audio, click: bpm === null ? undefined : { bpm, downbeat: this.beatTime(0)! } };
  }

  /** Let go of the microphone */
  close(): void {
    if (this.timer) clearInterval(this.timer);
    this.source.disconnect();
    for (const track of this.stream.getTracks()) track.stop();
  }

  /** A click of filtered noise: it has no pitch for the tracker to mistake for the voice if it leaks into the microphone */
  private tick(at: number, accent: boolean): void {
    const { context } = this;
    const source = new AudioBufferSourceNode(context, { buffer: this.click });
    const band = new BiquadFilterNode(context, { type: 'bandpass', frequency: accent ? 3200 : 2200, Q: 1.4 });
    const gain = new GainNode(context, { gain: accent ? 0.7 : 0.4 });
    source.connect(band).connect(gain).connect(context.destination);
    source.start(at);
  }

  /** From the audio clock to the ear */
  private outputDelay(): number {
    return (this.context.outputLatency || 0) + this.context.baseLatency;
  }

  /** From the microphone to the audio clock */
  private inputDelay(): number {
    return (this.stream.getAudioTracks()[0]?.getSettings() as MediaTrackSettings & { latency?: number }).latency ?? 0;
  }
}

/** Follow the pitch through a recording from a file, a second at a time, letting the page draw in between */
export async function hearFile(file: File, context: BaseAudioContext): Promise<Heard> {
  let audio: AudioBuffer;
  try {
    audio = await context.decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new Error(`${file.name} couldn’t be read as audio.`);
  }
  const mono = new Float32Array(audio.length);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const channel = audio.getChannelData(c);
    for (let i = 0; i < channel.length; i++) mono[i] += channel[i] / audio.numberOfChannels;
  }
  const tracker = new PitchTracker(audio.sampleRate);
  for (let i = 0; i < mono.length; i += audio.sampleRate) {
    tracker.push(mono.subarray(i, i + audio.sampleRate));
    await new Promise((resolve) => setTimeout(resolve));
  }
  return { frames: tracker.frames, audio };
}

function microphoneError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'The microphone is blocked. Allow it for this page from the address bar, then try again.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No microphone was found.';
  if (name === 'NotReadableError') return 'The microphone is busy in another app.';
  return 'The microphone couldn’t be opened.';
}

function noise(context: BaseAudioContext, seconds: number): AudioBuffer {
  const buffer = context.createBuffer(1, Math.round(seconds * context.sampleRate), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (0.0025 * context.sampleRate));
  return buffer;
}
