// Reads the analyser once per frame and derives what the visuals answer to: a levelled log-frequency spectrum, bass, mid and treble
// energy, the overall level, and onsets found by spectral flux in the low band.

export const BAND_COUNT = 96;
export const LOW_HZ = 32;
export const HIGH_HZ = 16000;

/** dB per octave added above 1 kHz and taken off below, so a typical mix (which falls off with pitch) reads level */
const TILT_DB = 3;
/** The quietest a band can be and still show (0-1 of the analyser's dB range) */
const FLOOR = 0.3;
/** The running peak never drops below this, so silence is not blown up into noise */
const MIN_PEAK = 0.58;
/** Onsets: how far above the recent flux a frame must be (in standard deviations), and how soon another may follow */
const ONSET_SIGMA = 1.5;
const ONSET_MIN_FLUX = 0.008;
const ONSET_GAP = 0.18;

interface Band {
  /** Bins [lo, hi) the band takes its peak from, or a fractional bin to read between when the band is narrower than a bin */
  lo: number;
  hi: number;
  center: number;
  /** The tilt added to the band, in 0-1 units */
  tilt: number;
}

export class Analysis {
  readonly frequency: Uint8Array<ArrayBuffer>;
  readonly waveform: Float32Array<ArrayBuffer>;
  readonly bands = new Float32Array(BAND_COUNT);
  readonly binHz: number;
  bass = 0;
  mid = 0;
  treble = 0;
  level = 0;
  beat = false;
  pulse = 0;

  private readonly analyser: AnalyserNode | null;
  private readonly layout: Band[];
  private readonly ranges: { bass: [number, number]; mid: [number, number]; treble: [number, number] };
  private readonly lowBins: [number, number];
  private readonly previousLow: Float32Array;
  private readonly fluxHistory = new Float32Array(48);
  private fluxIndex = 0;
  private sinceBeat = 0;
  /** Running peaks for levelling: quiet songs are lifted, loud ones are not clipped */
  private peak = MIN_PEAK;
  private loudest = 0.25;

  constructor(analyser: AnalyserNode | null) {
    this.analyser = analyser;
    const bins = analyser?.frequencyBinCount ?? 1024;
    this.frequency = new Uint8Array(bins);
    this.waveform = new Float32Array(analyser?.fftSize ?? 2048);
    this.binHz = analyser ? analyser.context.sampleRate / analyser.fftSize : 48000 / 2048;
    const dbRange = analyser ? analyser.maxDecibels - analyser.minDecibels : 65;
    this.layout = Array.from({ length: BAND_COUNT }, (_, i) => {
      const from = bandHz(i) / this.binHz;
      const to = bandHz(i + 1) / this.binHz;
      const center = Math.sqrt(from * to);
      return {
        lo: Math.floor(from),
        hi: Math.min(bins, Math.max(Math.floor(from) + 1, Math.ceil(to))),
        center,
        tilt: (TILT_DB * Math.log2((center * this.binHz) / 1000)) / dbRange,
      };
    });
    const bandsIn = (lo: number, hi: number): [number, number] => {
      const index = (hz: number) => Math.round((Math.log(hz / LOW_HZ) / Math.log(HIGH_HZ / LOW_HZ)) * BAND_COUNT);
      return [Math.max(0, index(lo)), Math.min(BAND_COUNT, index(hi))];
    };
    this.ranges = { bass: bandsIn(LOW_HZ, 160), mid: bandsIn(250, 2000), treble: bandsIn(4000, 12000) };
    this.lowBins = [Math.max(1, Math.floor(30 / this.binHz)), Math.ceil(200 / this.binHz)];
    this.previousLow = new Float32Array(this.lowBins[1] - this.lowBins[0]);
  }

  /** Read the analyser and update every feature. `sensitivity` (0.5-2) scales how strongly the music shows. */
  update(dt: number, sensitivity: number): void {
    const analyser = this.analyser;
    if (!analyser) {
      this.decay(dt);
      return;
    }
    analyser.getByteFrequencyData(this.frequency);
    analyser.getFloatTimeDomainData(this.waveform);
    this.readBands(dt, sensitivity);
    this.readLevel(dt, sensitivity);
    this.readOnsets(dt);
  }

  private readBands(dt: number, sensitivity: number): void {
    const bins = this.frequency;
    let loudest = 0;
    const raw = scratch(BAND_COUNT);
    for (let i = 0; i < BAND_COUNT; i++) {
      const band = this.layout[i];
      let value: number;
      if (band.hi - band.lo <= 1) {
        // Narrower than a bin: read between the two nearest bins, so the low end is a curve and not a staircase
        const c = Math.min(bins.length - 2, band.center);
        const k = Math.floor(c);
        value = bins[k] + (bins[k + 1] - bins[k]) * (c - k);
      } else {
        value = 0;
        for (let b = band.lo; b < band.hi; b++) value = Math.max(value, bins[b]);
      }
      const v = value / 255 + band.tilt;
      raw[i] = v;
      loudest = Math.max(loudest, v);
    }
    // The peak follows the loudest band up at once and comes back down over seconds
    this.peak = Math.max(MIN_PEAK, loudest, this.peak - dt * 0.035);
    const span = this.peak - FLOOR;
    const rise = 1 - Math.exp(-dt / 0.035);
    const fall = 1 - Math.exp(-dt / 0.14);
    for (let i = 0; i < BAND_COUNT; i++) {
      const x = Math.min(1, Math.max(0, (raw[i] - FLOOR) / span) ** 1.6 * sensitivity);
      const prev = this.bands[i];
      this.bands[i] = prev + (x - prev) * (x > prev ? rise : fall);
    }
    this.bass = follow(this.bass, mean(this.bands, this.ranges.bass), dt, 0.05, 0.2);
    this.mid = follow(this.mid, mean(this.bands, this.ranges.mid), dt, 0.05, 0.25);
    this.treble = follow(this.treble, mean(this.bands, this.ranges.treble), dt, 0.04, 0.2);
  }

  private readLevel(dt: number, sensitivity: number): void {
    let sum = 0;
    const w = this.waveform;
    for (let i = 0; i < w.length; i += 2) sum += w[i] * w[i];
    const rms = Math.sqrt((sum * 2) / w.length);
    this.loudest = Math.max(0.12, rms, this.loudest - dt * 0.01);
    const x = Math.min(1, (rms / this.loudest) ** 0.8 * sensitivity * 0.85);
    this.level = follow(this.level, x, dt, 0.04, 0.3);
  }

  private readOnsets(dt: number): void {
    const [lo, hi] = this.lowBins;
    let flux = 0;
    for (let b = lo; b < hi; b++) {
      const v = this.frequency[b] / 255;
      const d = v - this.previousLow[b - lo];
      if (d > 0) flux += d;
      this.previousLow[b - lo] = v;
    }
    flux /= hi - lo;
    const history = this.fluxHistory;
    let m = 0;
    for (const f of history) m += f;
    m /= history.length;
    let variance = 0;
    for (const f of history) variance += (f - m) ** 2;
    const threshold = m + ONSET_SIGMA * Math.sqrt(variance / history.length);
    history[this.fluxIndex] = flux;
    this.fluxIndex = (this.fluxIndex + 1) % history.length;
    this.sinceBeat += dt;
    this.beat = flux > threshold && flux > ONSET_MIN_FLUX && this.sinceBeat > ONSET_GAP;
    if (this.beat) {
      this.sinceBeat = 0;
      this.pulse = Math.min(1, 0.55 + flux * 12);
    } else this.pulse *= Math.exp(-dt / 0.26);
  }

  /** No analyser: let everything fall back to rest */
  private decay(dt: number): void {
    const k = Math.exp(-dt / 0.2);
    for (let i = 0; i < BAND_COUNT; i++) this.bands[i] *= k;
    this.bass *= k;
    this.mid *= k;
    this.treble *= k;
    this.level *= k;
    this.pulse *= k;
    this.beat = false;
  }
}

/** The lower edge of a band, in Hz */
export function bandHz(i: number): number {
  return LOW_HZ * (HIGH_HZ / LOW_HZ) ** (i / BAND_COUNT);
}

/** Move towards a target: quickly when it rises (`attack` seconds), slowly when it falls (`release` seconds) */
function follow(value: number, target: number, dt: number, attack: number, release: number): number {
  return value + (target - value) * (1 - Math.exp(-dt / (target > value ? attack : release)));
}

function mean(values: Float32Array, [from, to]: [number, number]): number {
  let sum = 0;
  for (let i = from; i < to; i++) sum += values[i];
  return to > from ? sum / (to - from) : 0;
}

let scratchBuffer = new Float32Array(0);

/** A reused buffer, so frames allocate nothing */
function scratch(length: number): Float32Array {
  if (scratchBuffer.length < length) scratchBuffer = new Float32Array(length);
  return scratchBuffer;
}
