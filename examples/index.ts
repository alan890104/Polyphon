// Every example song, grouped into playlists (the player shows these).

import type { Song } from 'polyphon';

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
    description: 'Original pieces that show the notation: a 4/4 market tune, a 3/4 waltz, a piano ballad, a progressive-house track, and Gardel’s Por una Cabeza remade as electro tango.',
    songs: [
      { id: 'morning-market', load: () => load(import('./demo/morning-market.ts')) },
      { id: 'night-waltz', load: () => load(import('./demo/night-waltz.ts')) },
      { id: 'after-midnight', load: () => load(import('./demo/after-midnight.ts')) },
      { id: 'neon-tide', load: () => load(import('./demo/neon-tide.ts')) },
      { id: 'por-una-cabeza', load: () => load(import('./demo/por-una-cabeza.ts')) },
    ],
  },
  {
    id: 'classics',
    title: 'Classics',
    description: 'Public-domain music, note for note: the opening of Beethoven’s Moonlight Sonata, Pachelbel’s Canon in D for three violins and cello (and the same canon moved into D minor), the exposition of Beethoven’s Fifth Symphony, the Prelude to Bizet’s Carmen for full orchestra, and the opening of Carmen’s Habanera for solo violin, chorus and orchestra.',
    songs: [
      { id: 'moonlight', load: () => load(import('./classics/moonlight.ts')) },
      { id: 'canon', load: () => load(import('./classics/canon.ts')) },
      { id: 'canon-minor', load: () => load(import('./classics/canon-minor.ts')) },
      { id: 'symphony5', load: () => load(import('./classics/symphony5.ts')) },
      { id: 'carmen', load: () => load(import('./classics/carmen.ts')) },
      { id: 'habanera', load: () => load(import('./classics/habanera.ts')) },
    ],
  },
];
