import { beforeEach, describe, expect, it } from 'vitest';
import { searchSongs } from '../src/core/search/searchSongs';
import { SearchFn } from '../src/core/matching/matchTrack';
import { YtResult } from '../src/providers/youtubeMusic/search';
import { Db } from '../src/db/database';
import { migrate, SCHEMA_VERSION } from '../src/db/migrations';
import {
  addYoutubeTrackToPlaylist, createPlaylist, deletePlaylist, getChosenVideos, getMatchStatus,
  getPlaylistEntries, listPlaylists,
} from '../src/db/repository';
import { createTestDb } from './helpers/nodeSqliteDb';

const yt = (videoId: string, o: Partial<YtResult> = {}): YtResult => ({
  videoId, title: 'Blinding Lights', artists: ['The Weeknd'], durationSec: 200, kind: 'song', ...o,
});

describe('searchSongs', () => {
  it('consulta vacía no busca', async () => {
    let n = 0;
    expect(await searchSongs('  ', async () => { n++; return []; })).toEqual([]);
    expect(n).toBe(0);
  });
  it('quita duplicados y "other"', async () => {
    const r = await searchSongs('x', async () => [yt('A'), yt('A'), yt('B', { kind: 'other' }), yt('C')]);
    expect(r.map(x => x.videoId)).toEqual(['A', 'C']);
  });
  it('si el filtro no devuelve nada reintenta sin filtro', async () => {
    const search: SearchFn = async (_q, o) => (o?.filter === false ? [yt('V', { kind: 'video' }), yt('O', { kind: 'other' })] : []);
    expect((await searchSongs('x', search)).map(x => x.videoId)).toEqual(['V']);
  });
  it('limita a 20', async () => {
    expect(await searchSongs('x', async () => Array.from({ length: 40 }, (_, i) => yt('V' + i)))).toHaveLength(20);
  });
});

describe('añadir a playlist', () => {
  let db: Db;
  const input = (id: string) => ({ videoId: id, title: 'Blinding Lights', artists: ['The Weeknd'], album: 'After Hours', durationMs: 200000, version: 'studio' as const });
  beforeEach(async () => { db = createTestDb(); await migrate(db); });

  it('migra a la versión 2', async () => { expect(SCHEMA_VERSION).toBe(2); });

  it('crea playlist propia y rechaza nombre vacío', async () => {
    const id = await createPlaylist(db, '  Gym  ');
    expect((await listPlaylists(db))[0]).toMatchObject({ id, name: 'Gym', total: 0 });
    await expect(createPlaylist(db, '   ')).rejects.toThrow();
  });

  it('añade al final, con vídeo elegido y reproducible', async () => {
    const pl = await createPlaylist(db, 'A');
    await addYoutubeTrackToPlaylist(db, pl, input('V1'));
    const { added } = await addYoutubeTrackToPlaylist(db, pl, { ...input('V2'), title: 'Otra' });
    expect(added).toBe(true);
    const entries = await getPlaylistEntries(db, pl);
    expect(entries.map(e => e.track.title)).toEqual(['Blinding Lights', 'Otra']);
    expect(entries.map(e => e.videoId)).toEqual(['V1', 'V2']);
    expect(entries[0].track.externalIds.youtubeVideo).toBe('V1');
    expect(Object.keys(await getChosenVideos(db, pl))).toHaveLength(2);
  });

  it('no repite en la misma playlist, pero reutiliza la canción en otra', async () => {
    const a = await createPlaylist(db, 'A'); const b = await createPlaylist(db, 'B');
    const first = await addYoutubeTrackToPlaylist(db, a, input('V1'));
    expect((await addYoutubeTrackToPlaylist(db, a, input('V1'))).added).toBe(false);
    const second = await addYoutubeTrackToPlaylist(db, b, input('V1'));
    expect(second).toEqual({ added: true, trackId: first.trackId });
    expect(await getPlaylistEntries(db, a)).toHaveLength(1);
    expect(await getMatchStatus(db, first.trackId)).toEqual({ status: 'manual', videoId: 'V1' });
  });

  it('borrar una playlist conserva la canción si está en otra', async () => {
    const a = await createPlaylist(db, 'A'); const b = await createPlaylist(db, 'B');
    const { trackId } = await addYoutubeTrackToPlaylist(db, a, input('V1'));
    await addYoutubeTrackToPlaylist(db, b, input('V1'));
    await deletePlaylist(db, a);
    expect(await getMatchStatus(db, trackId)).not.toBeNull();
    await deletePlaylist(db, b);
    expect(await getMatchStatus(db, trackId)).toBeNull();
  });
});
