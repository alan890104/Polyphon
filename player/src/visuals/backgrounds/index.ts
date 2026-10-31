// Every background, in the order the settings drawer lists them.

import type { LayerKind } from '../types.ts';
import { aurora } from './aurora.ts';
import { cover } from './cover.ts';
import { image } from './image.ts';
import { ink } from './ink.ts';
import { starfield } from './starfield.ts';

export type BackgroundId = 'ink' | 'aurora' | 'starfield' | 'cover' | 'image';

export const BACKGROUNDS: readonly LayerKind<BackgroundId>[] = [ink, cover, aurora, starfield, image];

export function backgroundById(id: string): LayerKind<BackgroundId> {
  return BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0];
}
