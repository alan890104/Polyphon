// The soundtrack of Eldor (https://github.com/alan890104/eldor), a creature-battle RPG, written with this library.
// Regional variants (Seal Towers, wild encounters) come from one generator each, fed with a region's instruments and mode.

import type { MasterEq, Song } from 'polyphon';
import type { Playlist } from '../index.ts';

const REGIONS = ['forest', 'isles', 'volcano', 'highland', 'canyon', 'plains', 'holy', 'shadow', 'rift'] as const;

/**
 * Mastering EQ, measured per song: the amount by which (500 Hz + 1 kHz) exceeds (125 + 250 Hz) was made up 70% with warmth at 150 Hz
 * and 30% with a cut at 1.3 kHz, then the level was trimmed back. Songs not listed were already balanced.
 */
const MASTERING: Record<string, MasterEq> = {
  title: { warm: 5, cut: 2, trim: -1.6 },
  hub: { warm: 4.5, cut: 2, trim: -0.9 },
  map: { warm: 3, cut: 1, trim: -1.6 },
  ending: { warm: 2, cut: 1, trim: -0.5 },
  'field:forest': { warm: 3, cut: 1, trim: -1.1 },
  'field:isles': { warm: 2.5, cut: 1, trim: -0.9 },
  'field:highland': { warm: 6, cut: 2.5, trim: -0.3 },
  'field:plains': { warm: 1.5, cut: 0.5, trim: -0.3 },
  'field:holy': { warm: 3.5, cut: 1.5, trim: -0.9 },
  'field:shadow': { warm: 6, cut: 2.5, trim: -1.3 },
  'field:rift': { warm: 3.5, cut: 1.5, trim: -0.9 },
  rival: { warm: 1, cut: 0.5, trim: -0.9 },
  arena: { warm: 1.5, cut: 0.5, trim: -0.8 },
  corrupt: { warm: 2.5, cut: 1, trim: -0.9 },
  cult: { warm: 2, cut: 1, trim: -1.3 },
  boss: { warm: 1, cut: 0.5, trim: -0.6 },
  'tower:forest': { warm: 1.5, cut: 0.5, trim: -0.8 },
  'wild:forest': { warm: 3.5, cut: 1.5, trim: -1.2 },
  'tower:isles': { warm: 5, cut: 2, trim: -1.5 },
  'tower:highland': { warm: 3.5, cut: 1.5, trim: -1.4 },
  'wild:highland': { warm: 2, cut: 1, trim: -1.1 },
  'tower:canyon': { warm: 2, cut: 1, trim: -1.2 },
  'wild:canyon': { warm: 0.5, cut: 0, trim: -0.7 },
  'tower:plains': { warm: 2, cut: 1, trim: -0.8 },
  'wild:plains': { warm: 3, cut: 1, trim: -1.2 },
  'tower:holy': { warm: 6.5, cut: 2.5, trim: -1.3 },
  'wild:holy': { warm: 4, cut: 1.5, trim: -1.6 },
  'tower:shadow': { warm: 2.5, cut: 1, trim: -1.3 },
  'wild:shadow': { warm: 1.5, cut: 0.5, trim: -1 },
  'tower:rift': { warm: 3.5, cut: 1.5, trim: -0.8 },
  'wild:rift': { warm: 3, cut: 1.5, trim: -0.4 },
  'wild:hub': { warm: 1.5, cut: 0.5, trim: -0.9 },
};

type Loader = () => Promise<Song>;
const file = (name: string): Loader => () => import(`./songs/${name}.ts`).then((m: { default: Song }) => m.default);
const tower = (region: string): Loader => () => import('./songs/tower.ts').then((m) => m.tower(region));
const wild = (region: string): Loader => () => import('./songs/wild.ts').then((m) => m.wild(region));
const jingle = (name: 'fanfareSmall' | 'fanfareBig' | 'victory' | 'defeat'): Loader => () => import('./songs/jingles.ts').then((m) => m[name]);
const summon = (name: 'idle' | 'tension' | 'afterglow'): Loader => () => import('./songs/summon.ts').then((m) => m[name]);

/** A song of the soundtrack, with its mastering applied */
function song(id: string, load: Loader): Playlist['songs'][number] {
  const master = MASTERING[id];
  return { id: `eldor-${id.replace(':', '-')}`, load: () => load().then((s) => (master && !s.master ? { ...s, master } : s)) };
}

export const eldorPlaylists: Playlist[] = [
  {
    id: 'eldor-themes',
    title: 'Eldor: Themes and Towns',
    description: 'The overture, the hub town, the world map and the ending.',
    songs: ['title', 'hub', 'map', 'ending'].map((id) => song(id, file(id))),
  },
  {
    id: 'eldor-fields',
    title: 'Eldor: Fields',
    description: 'One theme for each of the nine regions you walk through, each in its own mode with its own folk instruments.',
    songs: REGIONS.map((r) => song(`field:${r}`, file(r))),
  },
  {
    id: 'eldor-towers',
    title: 'Eldor: Seal Towers',
    description: 'Theme and variations: nine towers share one set of material, each recast in its region’s mode, tempo and instruments.',
    songs: REGIONS.map((r) => song(`tower:${r}`, tower(r))),
  },
  {
    id: 'eldor-wild',
    title: 'Eldor: Wild Encounters',
    description: 'The battle theme for wild spirits, regenerated for every region from one generator.',
    songs: [song('wild:hub', wild('hub')), ...REGIONS.map((r) => song(`wild:${r}`, r === 'rift' ? file('wildRift') : wild(r)))],
  },
  {
    id: 'eldor-battles',
    title: 'Eldor: Battles',
    description: 'Trainers, the rival, the arena, corrupted spirits, the cult, the bosses and the final battle.',
    songs: ['trainer', 'rival', 'arena', 'corrupt', 'cult', 'boss', 'final'].map((id) => song(id, file(id))),
  },
  {
    id: 'eldor-short',
    title: 'Eldor: Summons and Fanfares',
    description: 'The Star Gate summon loops, and the short pieces for victory, defeat and rewards.',
    songs: [
      song('summon:idle', summon('idle')),
      song('summon:tension', summon('tension')),
      song('summon:afterglow', summon('afterglow')),
      song('fanfareSmall', jingle('fanfareSmall')),
      song('fanfareBig', jingle('fanfareBig')),
      song('victory', jingle('victory')),
      song('defeat', jingle('defeat')),
    ],
  },
];
