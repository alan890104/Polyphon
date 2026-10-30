// The library the player shows: every playlist in examples/, with each song loaded up front for its title, tempo, length and tracks,
// and MIDI files the listener imports (converted in the browser and kept in memory).

import { songDuration, songFromMidi, type Song } from 'polyphon';
import { playlists, type Playlist } from '../../examples/index.ts';
import { errorMessage } from './format.ts';

/** Tracks as a mixer shows them: an intro track and a body track with the same name are one */
export interface TrackGroup {
  name: string;
  instruments: string[];
}

/** A song that loaded and can be played */
export interface ReadySong {
  status: 'ready';
  id: string;
  song: Song;
  /** Seconds for one pass: the intro, then the body once */
  duration: number;
  tracks: TrackGroup[];
}

/** A song whose module failed to load: listed, but not playable */
export interface BrokenSong {
  status: 'broken';
  id: string;
  error: string;
}

export type LibrarySong = ReadySong | BrokenSong;

export const IMPORTS_ID = 'imports';
export const MIDI_FILE = /\.midi?$/i;

export interface LibraryPlaylist {
  id: string;
  title: string;
  description: string;
  songs: LibrarySong[];
  /** Seconds to play every song once */
  duration: number;
}

/** Load every song of every playlist (cheap: a song is plain data until it plays) */
export function loadLibrary(): Promise<LibraryPlaylist[]> {
  return Promise.all(playlists.map(loadPlaylist));
}

/** Convert a .mid / .midi file into a song; its title is the file name without the extension */
export async function importMidi(file: File, id: string): Promise<ReadySong> {
  if (!MIDI_FILE.test(file.name)) throw new Error('Only .mid and .midi files can be imported');
  return readySong(id, songFromMidi(await file.arrayBuffer(), { title: file.name.replace(MIDI_FILE, '') }));
}

/** The playlist of imported songs */
export function importsPlaylist(songs: ReadySong[]): LibraryPlaylist {
  return {
    id: IMPORTS_ID,
    title: 'Your imports',
    description: 'MIDI files you opened in this session. They stay in this tab: nothing is uploaded.',
    songs,
    duration: totalDuration(songs),
  };
}

/** The songs of a playlist that can be played, in order */
export function playable(playlist: LibraryPlaylist): ReadySong[] {
  return playlist.songs.filter((s) => s.status === 'ready');
}

async function loadPlaylist({ id, title, description, songs }: Playlist): Promise<LibraryPlaylist> {
  const loaded = await Promise.all(songs.map(loadSong));
  return { id, title, description, songs: loaded, duration: totalDuration(loaded) };
}

async function loadSong({ id, load }: Playlist['songs'][number]): Promise<LibrarySong> {
  try {
    return readySong(id, await load());
  } catch (error) {
    return { status: 'broken', id, error: errorMessage(error) };
  }
}

function readySong(id: string, song: Song): ReadySong {
  const { intro, loop } = songDuration(song);
  return { status: 'ready', id, song, duration: intro + loop, tracks: trackGroups(song) };
}

function totalDuration(songs: LibrarySong[]): number {
  return songs.reduce((sum, s) => sum + (s.status === 'ready' ? s.duration : 0), 0);
}

/** Group a song's tracks by the name a playback gives them (the instrument's when the track has none) */
function trackGroups(song: Song): TrackGroup[] {
  const groups = new Map<string, Set<string>>();
  for (const track of [...(song.intro ?? []), ...song.tracks]) {
    const name = track.name ?? track.instrument;
    groups.set(name, (groups.get(name) ?? new Set()).add(track.instrument));
  }
  return [...groups].map(([name, instruments]) => ({ name, instruments: [...instruments] }));
}
