// The microphone's samples, passed to the page as they arrive: in pieces of 2048 (about 43 ms), each with the audio clock's time at
// its first sample, so the page can line the voice up with the metronome it heard.

declare const currentTime: number;
declare const sampleRate: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare function registerProcessor(name: string, processor: typeof AudioWorkletProcessor): void;

const PIECE = 2048;

class Recorder extends AudioWorkletProcessor {
  private piece = new Float32Array(PIECE);
  private length = 0;
  private time = 0;

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    if (this.length === 0) this.time = currentTime;
    this.piece.set(channel, this.length);
    this.length += channel.length;
    if (this.length + channel.length > PIECE) {
      const samples = this.piece.slice(0, this.length);
      this.port.postMessage({ time: this.time, sampleRate, samples }, [samples.buffer]);
      this.length = 0;
    }
    return true;
  }
}

registerProcessor('polyphon-recorder', Recorder);
