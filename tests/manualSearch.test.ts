import { beforeEach, describe, expect, it } from 'vitest';
import { defaultManualQuery, searchManual } from '../src/core/matching/manualSearch';
import { SearchFn } from '../src/core/matching/matchTrack';
import { YtResult } from '../src/providers/youtubeMusic/search';
import { scoreCandidate } from '../src/core/matching/scoreCandidate';
import { toCandidate } from '../src/providers/youtubeMusic/toCandidate';
import { Db } from '../src/db/database';
import { migrate } from '../src/db/migrations';
import {
  getChosenVideos, getMatchStatus, recordMatching, resolveManualFromSearch, upsertTrack,
} from '../src/db/repository';
import { Track } from '../src/models/Track';
import { createTestDb } from './helpers/nodeSqliteDb';

const track: Track = {
  id: 't1', title: 'Blinding Lights', artists: ['The Weeknd'], durationMs: 200000,
  version: 'studio', externalIds: { spotify: 'sp1' },
};
const yt = (videoId: string, o: Partial<YtResult> = {}): YtResult => ({
  videoId, title: 'Blinding Lights', artists: ['The Weeknd'], durationSec: 200, kind: 'song', ...o,
});

describe('searchManual', () => {
  it('consulta inicial: artista + título', () => {
    expect(defaultManualQuery(track)).toBe('The Weeknd Blinding Lights');
  });

  it('consulta vacía no busca', async () => {
    let calls = 0;
    const search: SearchFn = async () => { calls++; return []; };
    expect(await searchManual(track, '   ', search)).toEqual([]);
    expect(calls).toBe(0);
  });

  it('une canciones y sin filtro, sin duplicados, y descarta "other"', async () => {
    const search: SearchFn = async (_q, o) =>
      o?.filter === false
        ? [yt('A'), yt('LIVE', { title: 'Blinding Lights (Live)', kind: 'video', durationSec: 260 }), yt('X', { kind: 'other' })]
        : [yt('A'), yt('B', { artists: ['Otro'] })];
    const r = await searchManual(track, 'blinding', search);
    expect(r.map(x => x.candidate.externalId).sort()).toEqual(['A', 'B', 'LIVE']);
  });

  it('ordena por puntuación y no esconde los rechazados', async () => {
    const search: SearchFn = async () => [
      yt('BAD', { artists: ['Otro'], durationSec: 100 }),
      yt('GOOD'),
    ];
    const r = await searchManual(track, 'x', search);
    expect(r[0].candidate.externalId).toBe('GOOD');
    expect(r[0].result.score).toBeGreaterThan(r[1].result.score);
    expect(r).toHaveLength(2);
  });

  it('si falla una de las búsquedas usa la otra; si fallan ambas, lanza', async () => {
    const half: SearchFn = async (_q, o) => { if (o?.filter === false) throw new Error('boom'); return [yt('A')]; };
    expect((await searchManual(track, 'x', half)).map(x => x.candidate.externalId)).toEqual(['A']);
    const none: SearchFn = async () => { throw new Error('sin red'); };
    await expect(searchManual(track, 'x', none)).rejects.toThrow('sin red');
  });

  it('limita a 15 resultados', async () => {
    const search: SearchFn = async () => Array.from({ length: 30 }, (_, i) => yt('V' + i));
    expect(await searchManual(track, 'x', search)).toHaveLength(15);
  });
});

describe('resolveManualFromSearch', () => {
  let db: Db;
  beforeEach(async () => { db = createTestDb(); await migrate(db); await upsertTrack(db, track); });

  it('guarda el vídeo elegido, aunque no estuviera entre los candidatos', async () => {
    const c = toCandidate(yt('NEW', { title: 'Blinding Lights (Live)', kind: 'video' }));
    await resolveManualFromSearch(db, track.id, c, scoreCandidate(track, c));
    expect(await getMatchStatus(db, track.id)).toEqual({ status: 'manual', videoId: 'NEW' });
  });

  it('el vídeo aparece en getChosenVideos (la playlist lo muestra)', async () => {
    await db.runAsync("INSERT INTO playlists (id, name, created_at) VALUES ('p','L',1)");
    await db.runAsync("INSERT INTO playlist_tracks (playlist_id, position, track_id) VALUES ('p',0,?)", [track.id]);
    const c = toCandidate(yt('NEW'));
    await resolveManualFromSearch(db, track.id, c, scoreCandidate(track, c));
    expect((await getChosenVideos(db, 'p'))[track.id]).toMatchObject({ title: 'Blinding Lights' });
  });

  it('corrige una coincidencia automática previa y un nuevo matching no la pisa', async () => {
    const wrong = toCandidate(yt('WRONG'));
    await recordMatching(db, track.id, [{ candidate: wrong, result: scoreCandidate(track, wrong) }]);
    expect((await getMatchStatus(db, track.id))?.videoId).toBe('WRONG');

    const right = toCandidate(yt('RIGHT'));
    await resolveManualFromSearch(db, track.id, right, scoreCandidate(track, right));
    await recordMatching(db, track.id, [{ candidate: wrong, result: scoreCandidate(track, wrong) }]);
    expect(await getMatchStatus(db, track.id)).toEqual({ status: 'manual', videoId: 'RIGHT' });
  });

  it('elegir dos veces el mismo vídeo no falla (INSERT OR REPLACE)', async () => {
    const c = toCandidate(yt('SAME'));
    await resolveManualFromSearch(db, track.id, c, scoreCandidate(track, c));
    await resolveManualFromSearch(db, track.id, c, scoreCandidate(track, c));
    expect((await getMatchStatus(db, track.id))?.videoId).toBe('SAME');
  });
});
