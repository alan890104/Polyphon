// Every example song, grouped into playlists (the player shows these).

import type { Song } from 'polyphon';
import { eldorPlaylists } from './eldor/index.ts';

export interface Playlist {
  id: string;
  title: string;
  description: string;
  songs: { id: string; load: () => Promise<Song> }[];
}

const load = (m: Promise<{ default: Song }>) => m.then((x) => x.default);

export const playlists: Playlist[] = [
  {
    id: 'demo',
    title: 'Getting started',
    description: 'Two short pieces that show the notation: a 4/4 market tune and a 3/4 waltz.',
    songs: [
      { id: 'morning-market', load: () => load(import('./demo/morning-market.ts')) },
      { id: 'night-waltz', load: () => load(import('./demo/night-waltz.ts')) },
    ],
  },
  {
    id: 'night',
    title: 'Night Pieces',
    description: 'The opening of Beethoven’s Moonlight Sonata, note for note, and an original piano ballad.',
    songs: [
      { id: 'moonlight', load: () => load(import('./classics/moonlight.ts')) },
      { id: 'after-midnight', load: () => load(import('./demo/after-midnight.ts')) },
    ],
  },
  ...eldorPlaylists,
];
