import { beforeEach, describe, expect, it } from 'vitest';
import { Db } from '../src/db/database';
import { migrate } from '../src/db/migrations';
import { addYoutubeTrackToPlaylist, createPlaylist, getPlaylistCovers, resolveManual, savePlaylist, upsertTrack } from '../src/db/repository';
import { Track } from '../src/models/Track';
import { createTestDb } from './helpers/nodeSqliteDb';
import { greeting, tintFor, tints } from '../src/ui/palette';

const track = (id: string): Track => ({
  id, title: 'T' + id, artists: ['A'], version: 'studio', externalIds: { spotify: 'sp_' + id },
});
let db: Db;
beforeEach(async () => { db = createTestDb(); await migrate(db); });

describe('portadas de playlist', () => {
  it('toma los vídeos de las primeras canciones resueltas, en orden y sin repetir, hasta 4', async () => {
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) await upsertTrack(db, track(id));
    const pl = await savePlaylist(db, { name: 'L' }, ['a', 'b', 'c', 'd', 'e', 'f']);
    await resolveManual(db, 'b', 'v1'); await resolveManual(db, 'c', 'v1'); // repetido
    await resolveManual(db, 'd', 'v2'); await resolveManual(db, 'e', 'v3');
    await resolveManual(db, 'f', 'v4'); await resolveManual(db, 'a', 'v5');
    expect((await getPlaylistCovers(db))[pl]).toEqual(['v5', 'v1', 'v2', 'v3']);
  });
  it('playlists sin canciones resueltas no aparecen; las propias sí', async () => {
    await upsertTrack(db, track('a'));
    const sin = await savePlaylist(db, { name: 'Sin' }, ['a']);
    const own = await createPlaylist(db, 'Mía');
    await addYoutubeTrackToPlaylist(db, own, { videoId: 'x', title: 'X', artists: ['Y'], version: 'studio' });
    const covers = await getPlaylistCovers(db);
    expect(covers[sin]).toBeUndefined();
    expect(covers[own]).toEqual(['x']);
  });
});

describe('colores y saludo', () => {
  it('el mismo nombre da siempre el mismo par de colores', () => {
    expect(tintFor('Rock')).toEqual(tintFor('Rock'));
    expect(tints).toContain(tintFor('cualquier cosa'));
  });
  it('saludo según la hora', () => {
    expect(greeting(new Date(2026, 0, 1, 9))).toBe('Buenos días');
    expect(greeting(new Date(2026, 0, 1, 15))).toBe('Buenas tardes');
    expect(greeting(new Date(2026, 0, 1, 23))).toBe('Buenas noches');
    expect(greeting(new Date(2026, 0, 1, 3))).toBe('Buenas noches');
  });
});
