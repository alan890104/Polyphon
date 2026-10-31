// Every visual style, in the order the settings drawer lists them.

import type { LayerKind } from '../types.ts';
import { circular } from './circular.ts';
import { fallingNotes } from './fallingNotes.ts';
import { musicBox } from './musicBox.ts';
import { particles } from './particles.ts';
import { ridgeline } from './ridgeline.ts';
import { spectrum } from './spectrum.ts';
import { waveform } from './waveform.ts';

export type StyleId = 'musicbox' | 'circular' | 'spectrum' | 'waveform' | 'particles' | 'notes' | 'ridgeline';

export const STYLES: readonly LayerKind<StyleId>[] = [musicBox, circular, fallingNotes, spectrum, waveform, ridgeline, particles];

export function styleById(id: string): LayerKind<StyleId> {
  return STYLES.find((s) => s.id === id) ?? STYLES[0];
}
