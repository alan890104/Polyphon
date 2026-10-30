import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compileSection, songDuration } from 'polyphon';
import { playlists } from '../examples/index.ts';

test('every example song loads, compiles and has a length', async () => {
  let count = 0;
  for (const playlist of playlists) {
    for (const entry of playlist.songs) {
      const song = await entry.load();
      for (const section of [song.intro ?? [], song.tracks]) if (section.length) compileSection(section, song.meter ?? 16);
      const { intro, loop } = songDuration(song);
      assert.ok(intro + loop > 1, `${entry.id} is too short`);
      count++;
    }
  }
  assert.ok(count >= 50, `only ${count} example songs`);
});
