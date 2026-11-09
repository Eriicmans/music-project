import { beforeEach, describe, expect, it } from 'vitest';
import { Db } from '../src/db/database';
import { exportLibrary, importLibrary, parseBackup } from '../src/db/backup';
import { migrate } from '../src/db/migrations';
import {
  addYoutubeTrackToPlaylist, createPlaylist, getChosenVideos, getMatchStatus, getPlaylistEntries, getTrack,
  listPlaylists, removeTrackFromPlaylist, renamePlaylist, resolveManual, savePlaylist, upsertTrack,
} from '../src/db/repository';
import { Track } from '../src/models/Track';
import { createTestDb } from './helpers/nodeSqliteDb';

const track = (id: string, o: Partial<Track> = {}): Track => ({
  id, title: 'Canción ' + id, artists: ['Artista'], durationMs: 200000, version: 'studio',
  externalIds: { spotify: 'sp_' + id }, ...o,
});
const yt = (videoId: string) => ({ videoId, title: 'Vídeo ' + videoId, artists: ['Canal'], version: 'studio' as const });

let db: Db;
beforeEach(async () => { db = createTestDb(); await migrate(db); });

const ids = async (pl: string) => (await getPlaylistEntries(db, pl)).map(e => e.track.id);

describe('reimportar una playlist de Spotify', () => {
  it('conserva las canciones añadidas a mano, al final', async () => {
    for (const id of ['a', 'b']) await upsertTrack(db, track(id));
    const pl = await savePlaylist(db, { name: 'L', spotifyId: 'pl1' }, ['a', 'b']);
    const { trackId: manual } = await addYoutubeTrackToPlaylist(db, pl, yt('v1'));

    await upsertTrack(db, track('c'));
    await savePlaylist(db, { name: 'L', spotifyId: 'pl1' }, ['c', 'a']);
    expect(await ids(pl)).toEqual(['c', 'a', manual]);
    expect(await getMatchStatus(db, manual)).toMatchObject({ status: 'manual', videoId: 'v1' });
  });

  it('borra las canciones que desaparecen de Spotify, salvo las usadas en otra playlist', async () => {
    for (const id of ['a', 'b', 'c']) await upsertTrack(db, track(id));
    const pl = await savePlaylist(db, { name: 'L', spotifyId: 'pl1' }, ['a', 'b', 'c']);
    await savePlaylist(db, { name: 'Otra', spotifyId: 'pl2' }, ['c']);
    await savePlaylist(db, { name: 'L', spotifyId: 'pl1' }, ['a']);
    expect(await ids(pl)).toEqual(['a']);
    expect(await getTrack(db, 'b')).toBeNull();
    expect(await getTrack(db, 'c')).not.toBeNull();
  });
});

describe('quitar canciones y renombrar', () => {
  it('quita por posición, recompone el orden y borra la canción huérfana', async () => {
    for (const id of ['a', 'b', 'c']) await upsertTrack(db, track(id));
    const pl = await savePlaylist(db, { name: 'L' }, ['a', 'b', 'c']);
    await resolveManual(db, 'b', 'vb');
    expect(await removeTrackFromPlaylist(db, pl, 1)).toBe(true);
    const entries = await getPlaylistEntries(db, pl);
    expect(entries.map(e => [e.position, e.track.id])).toEqual([[0, 'a'], [1, 'c']]);
    expect(await getTrack(db, 'b')).toBeNull();
    expect(await getMatchStatus(db, 'b')).toBeNull();
  });
  it('conserva la canción si está en otra playlist y devuelve false si no existe la posición', async () => {
    await upsertTrack(db, track('a'));
    const p1 = await savePlaylist(db, { name: 'P1' }, ['a']);
    await savePlaylist(db, { name: 'P2' }, ['a']);
    expect(await removeTrackFromPlaylist(db, p1, 0)).toBe(true);
    expect(await getTrack(db, 'a')).not.toBeNull();
    expect(await removeTrackFromPlaylist(db, p1, 5)).toBe(false);
  });
  it('renombra y rechaza nombres vacíos', async () => {
    const pl = await createPlaylist(db, 'Vieja');
    await renamePlaylist(db, pl, '  Nueva  ');
    expect((await listPlaylists(db))[0].name).toBe('Nueva');
    await expect(renamePlaylist(db, pl, '   ')).rejects.toThrow();
  });
});

describe('copia de seguridad', () => {
  async function seed(d: Db) {
    await upsertTrack(d, track('a')); await upsertTrack(d, track('b'));
    const sp = await savePlaylist(d, { name: 'De Spotify', spotifyId: 'pl1', sourceUrl: 'https://x' }, ['a', 'b']);
    await resolveManual(d, 'a', 'va');
    const own = await createPlaylist(d, 'Mía');
    await addYoutubeTrackToPlaylist(d, own, yt('v9'));
    return { sp, own };
  }

  it('exporta y restaura en una base vacía (orden, vídeos elegidos y canciones propias)', async () => {
    await seed(db);
    const backup = parseBackup(JSON.stringify(await exportLibrary(db)));

    const db2 = createTestDb(); await migrate(db2);
    const r = await importLibrary(db2, backup);
    expect(r).toMatchObject({ playlists: 2, skippedPlaylists: 0, tracks: 3 });

    const pls = await listPlaylists(db2);
    expect(pls.map(p => p.name).sort()).toEqual(['De Spotify', 'Mía']);
    const sp = pls.find(p => p.name === 'De Spotify')!;
    const entries = await getPlaylistEntries(db2, sp.id);
    expect(entries.map(e => e.track.title)).toEqual(['Canción a', 'Canción b']);
    expect(entries.map(e => e.status)).toEqual(['manual', null]);
    expect(Object.keys(await getChosenVideos(db2, sp.id))).toHaveLength(1);
    const own = pls.find(p => p.name === 'Mía')!;
    expect((await getPlaylistEntries(db2, own.id))[0]).toMatchObject({ videoId: 'v9', status: 'manual' });
  });

  it('restaurar dos veces no duplica nada', async () => {
    await seed(db);
    const backup = parseBackup(JSON.stringify(await exportLibrary(db)));
    const r = await importLibrary(db, backup);
    expect(r).toMatchObject({ playlists: 0, skippedPlaylists: 2, tracks: 0, matches: 0 });
    expect(await listPlaylists(db)).toHaveLength(2);
  });

  it('no pisa una coincidencia que ya existe', async () => {
    await seed(db);
    const backup = parseBackup(JSON.stringify(await exportLibrary(db)));
    const db2 = createTestDb(); await migrate(db2);
    await upsertTrack(db2, track('a'));
    await resolveManual(db2, 'a', 'otro');
    await importLibrary(db2, backup);
    expect(await getMatchStatus(db2, 'a')).toMatchObject({ videoId: 'otro' });
  });

  it('rechaza textos que no son una copia', () => {
    expect(() => parseBackup('hola')).toThrow();
    expect(() => parseBackup('{"format":"otra-cosa"}')).toThrow();
    expect(() => parseBackup(JSON.stringify({ format: 'music-project-backup', version: 99, tracks: [], playlists: [] }))).toThrow();
    expect(() => parseBackup(JSON.stringify({
      format: 'music-project-backup', version: 1, tracks: [],
      playlists: [{ name: 'X', createdAt: 1, tracks: ['no-existe'] }],
    }))).toThrow();
  });
});
