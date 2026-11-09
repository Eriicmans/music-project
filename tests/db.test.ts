import { beforeEach, describe, expect, it } from 'vitest';
import { Db } from '../src/db/database';
import { migrate, SCHEMA_VERSION } from '../src/db/migrations';
import {
  getCachedVideoId, getMatchStatus, getPlaylistEntries, getTrack, listPendingReviews,
  recordMatching, resolveManual, savePlaylist, upsertTrack, countByStatus, ScoredCandidate,
} from '../src/db/repository';
import { scoreCandidate } from '../src/core/matching/scoreCandidate';
import { Track, TrackCandidate } from '../src/models/Track';
import { createTestDb } from './helpers/nodeSqliteDb';

const track = (id: string, o: Partial<Track> = {}): Track => ({
  id, title: 'Señorita', artists: ['Shawn Mendes', 'Camila Cabello'], album: 'Shawn Mendes',
  durationMs: 190000, version: 'studio', externalIds: { spotify: 'sp_' + id }, ...o,
});
const cand = (id: string, o: Partial<TrackCandidate> = {}): TrackCandidate => ({
  provider: 'youtube', externalId: id, title: 'Señorita', artists: ['Shawn Mendes'],
  durationMs: 190500, version: 'studio', ...o,
});
const score = (t: Track, c: TrackCandidate): ScoredCandidate => ({ candidate: c, result: scoreCandidate(t, c) });

let db: Db;
beforeEach(async () => { db = createTestDb(); await migrate(db); });

describe('migraciones', () => {
  it('son idempotentes y fijan la versión', async () => {
    expect(await migrate(db)).toBe(SCHEMA_VERSION);
    const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(v?.user_version).toBe(SCHEMA_VERSION);
  });
});

describe('canciones', () => {
  it('guarda y recupera con artistas como lista', async () => {
    await upsertTrack(db, track('a'));
    expect(await getTrack(db, 'a')).toMatchObject({ title: 'Señorita', artists: ['Shawn Mendes', 'Camila Cabello'] });
  });
  it('misma canción de Spotify no se duplica y conserva su id', async () => {
    const id1 = await upsertTrack(db, track('a'));
    const id2 = await upsertTrack(db, track('b', { externalIds: { spotify: 'sp_a' }, title: 'Señorita (v2)' }));
    expect(id2).toBe(id1);
    expect((await getTrack(db, id1))?.title).toBe('Señorita (v2)');
  });
});

describe('playlists', () => {
  it('conserva el orden y reimportar actualiza en vez de duplicar', async () => {
    await upsertTrack(db, track('a')); await upsertTrack(db, track('b', { title: 'Otra' }));
    const pl = await savePlaylist(db, { name: 'Mi lista', spotifyId: 'pl1' }, ['b', 'a']);
    expect((await getPlaylistEntries(db, pl)).map(e => e.track.id)).toEqual(['b', 'a']);
    const again = await savePlaylist(db, { name: 'Mi lista 2', spotifyId: 'pl1' }, ['a']);
    expect(again).toBe(pl);
    expect(await getPlaylistEntries(db, pl)).toHaveLength(1);
  });
});

describe('matching guardado', () => {
  it('auto: guarda vídeo y alimenta la caché', async () => {
    const t = track('a'); await upsertTrack(db, t);
    const st = await recordMatching(db, 'a', [score(t, cand('vid1')), score(t, cand('vidX', { artists: ['Otro'] }))]);
    expect(st).toBe('auto');
    expect(await getCachedVideoId(db, 'sp_a')).toBe('vid1');
  });
  it('dudoso: queda pendiente con candidatos ordenados y sin caché', async () => {
    const t = track('a'); await upsertTrack(db, t);
    const st = await recordMatching(db, 'a', [
      score(t, cand('v1', { durationMs: undefined })),
      score(t, cand('v2', { durationMs: 193000 })),
    ]);
    expect(st).toBe('pending');
    expect(await getCachedVideoId(db, 'sp_a')).toBeNull();
    const [p] = await listPendingReviews(db);
    expect(p.track.id).toBe('a');
    expect(p.candidates.map(c => c.score)).toEqual([...p.candidates.map(c => c.score)].sort((x, y) => y - x));
  });
  it('sin candidatos válidos: none', async () => {
    const t = track('a'); await upsertTrack(db, t);
    expect(await recordMatching(db, 'a', [score(t, cand('v1', { artists: ['Otro'], title: 'Nada' }))])).toBe('none');
  });
  it('la decisión manual del usuario nunca se sobrescribe', async () => {
    const t = track('a'); await upsertTrack(db, t);
    await recordMatching(db, 'a', [score(t, cand('v1', { durationMs: undefined }))]);
    await resolveManual(db, 'a', 'elegido');
    expect(await recordMatching(db, 'a', [score(t, cand('vNuevo'))])).toBe('manual');
    expect(await getMatchStatus(db, 'a')).toEqual({ status: 'manual', videoId: 'elegido' });
    expect(await getCachedVideoId(db, 'sp_a')).toBe('elegido');
    expect(await listPendingReviews(db)).toHaveLength(0);
  });
  it('contadores por estado', async () => {
    const t = track('a'); await upsertTrack(db, t);
    await recordMatching(db, 'a', [score(t, cand('vid1'))]);
    expect(await countByStatus(db)).toEqual({ auto: 1 });
  });
});