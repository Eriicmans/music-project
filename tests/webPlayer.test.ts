import { beforeEach, describe, expect, it } from 'vitest';
import { Db } from '../src/db/database';
import { migrate } from '../src/db/migrations';
import { getPlaylistEntries } from '../src/db/repository';
import { FetchFn, parseEmbedHtml } from '../src/importers/spotify/embed';
import { importSpotifyPlaylist } from '../src/importers/spotify/importPlaylist';
import { FETCH_PLAYLIST_HASH, fetchFullPlaylist, mapItem, MAX_PAGES, PATHFINDER_URL } from '../src/importers/spotify/webPlayer';
import { createTestDb } from './helpers/nodeSqliteDb';

const PL = '37i9dQZF1DXcBWIGoYBM5M';
const TOKEN = 'BQDanonymousTokenForTests1234567890';
const sid = (n: number) => String(n).padStart(22, 'A');

const embedItem = (n: number) => ({ uri: `spotify:track:${sid(n)}`, title: `Canción ${n}`, subtitle: 'Uno, Dos', duration: 200000 + n });
const embedHtml = (count: number, token: string | null = TOKEN) =>
  `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: { pageProps: { state: {
      settings: token ? { session: { accessToken: token } } : {},
      data: { entity: { name: 'Larga', trackList: Array.from({ length: count }, (_, i) => embedItem(i + 1)) } },
    } } },
  })}</script></html>`;

const wpTrack = (n: number, o: Record<string, unknown> = {}) => ({
  itemV2: { data: {
    __typename: 'Track', uri: `spotify:track:${sid(n)}`, name: `Canción ${n}`,
    trackDuration: { totalMilliseconds: 200000 + n },
    artists: { items: [{ profile: { name: 'Uno' } }, { profile: { name: 'Dos' } }] },
    albumOfTrack: { name: 'Álbum', artists: { items: [{ profile: { name: 'Otro' } }] } },
    ...o,
  } },
});
const pageBody = (items: unknown[], total: number) => JSON.stringify({ data: { playlistV2: { content: { totalCount: total, items } } } });

type Reply = { ok: boolean; status: number; body: string };
interface Call { url: string; method?: string; headers?: Record<string, string>; body?: any }
/** Servidor simulado: el embed y pathfinder (paginado con `total` canciones). */
function makeFetch(o: {
  embedCount?: number; token?: string | null; total?: number;
  pathfinder?: (offset: number, call: Call) => Reply | Error | undefined;
}) {
  const calls: Call[] = [];
  const total = o.total ?? 250;
  const fn: FetchFn = async (url, init) => {
    const call: Call = { url, method: init?.method, headers: init?.headers, body: init?.body ? JSON.parse(init.body) : undefined };
    calls.push(call);
    if (url.startsWith('https://open.spotify.com/embed/')) {
      return { ok: true, status: 200, text: async () => embedHtml(o.embedCount ?? 100, o.token === undefined ? TOKEN : o.token) };
    }
    const offset = call.body.variables.offset as number;
    const custom = o.pathfinder?.(offset, call);
    if (custom instanceof Error) throw custom;
    if (custom) return { ok: custom.ok, status: custom.status, text: async () => custom.body };
    const items = Array.from({ length: Math.max(0, Math.min(100, total - offset)) }, (_, i) => wpTrack(offset + i + 1));
    return { ok: true, status: 200, text: async () => pageBody(items, total) };
  };
  return { fn, calls, pathfinderCalls: () => calls.filter(c => c.url === PATHFINDER_URL) };
}

const noWait = { pageDelayMs: 0 };

describe('token anónimo del embed', () => {
  it('lo lee de la ruta habitual y de otro sitio del JSON', () => {
    expect(parseEmbedHtml(embedHtml(3)).accessToken).toBe(TOKEN);
    const moved = `<script id="__NEXT_DATA__">${JSON.stringify({ x: { accessToken: TOKEN }, entity: { trackList: [embedItem(1)] } })}</script>`;
    expect(parseEmbedHtml(moved).accessToken).toBe(TOKEN);
  });
  it('sin token queda indefinido', () => {
    expect(parseEmbedHtml(embedHtml(3, null)).accessToken).toBeUndefined();
  });
});

describe('mapItem', () => {
  it('lee título, artistas, duración e id', () => {
    expect(mapItem(wpTrack(7))).toEqual({ spotifyId: sid(7), title: 'Canción 7', artists: ['Uno', 'Dos'], durationMs: 200007 });
  });
  it('usa los artistas del álbum si la pista no los trae', () => {
    expect(mapItem(wpTrack(7, { artists: undefined }))?.artists).toEqual(['Otro']);
  });
  it('omite episodios, archivos locales y elementos rotos', () => {
    expect(mapItem(wpTrack(1, { uri: `spotify:episode:${sid(1)}` }))).toBeNull();
    expect(mapItem(wpTrack(1, { uri: 'spotify:local:a:b:c:d' }))).toBeNull();
    expect(mapItem(wpTrack(1, { name: '' }))).toBeNull();
    expect(mapItem(null)).toBeNull();
    expect(mapItem({})).toBeNull();
  });
});

describe('fetchFullPlaylist', () => {
  it('pagina de 100 en 100 con la consulta y el token correctos', async () => {
    const srv = makeFetch({ total: 250 });
    const r = await fetchFullPlaylist(PL, TOKEN, srv.fn, noWait);
    expect(r).toMatchObject({ complete: true, total: 250 });
    expect(r.tracks).toHaveLength(250);
    const calls = srv.pathfinderCalls();
    expect(calls.map(c => c.body.variables.offset)).toEqual([0, 100, 200]);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].headers?.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(calls[0].body).toMatchObject({
      operationName: 'fetchPlaylist',
      variables: { uri: `spotify:playlist:${PL}`, limit: 100 },
      extensions: { persistedQuery: { version: 1, sha256Hash: FETCH_PLAYLIST_HASH } },
    });
  });
  it('pausa entre páginas (no tras la última)', async () => {
    const waits: number[] = [];
    await fetchFullPlaylist(PL, TOKEN, makeFetch({ total: 250 }).fn, { pageDelayMs: 50, sleep: async ms => { waits.push(ms); } });
    expect(waits).toEqual([50, 50]);
  });
  it('si falla la primera página lanza', async () => {
    const srv = makeFetch({ pathfinder: () => ({ ok: false, status: 403, body: '' }) });
    await expect(fetchFullPlaylist(PL, TOKEN, srv.fn, noWait)).rejects.toThrow('HTTP 403');
  });
  it('si falla una posterior devuelve lo conseguido, marcado como incompleto', async () => {
    const srv = makeFetch({ total: 250, pathfinder: off => (off >= 100 ? new Error('offline') : undefined) });
    const r = await fetchFullPlaylist(PL, TOKEN, srv.fn, noWait);
    expect(r.complete).toBe(false);
    expect(r.tracks).toHaveLength(100);
    expect(r.reason).toContain('offline');
  });
  it('detecta respuestas que no son JSON, con errores GraphQL o con otro formato', async () => {
    const bad = (body: string) => makeFetch({ pathfinder: () => ({ ok: true, status: 200, body }) }).fn;
    await expect(fetchFullPlaylist(PL, TOKEN, bad('<html>'), noWait)).rejects.toThrow('JSON');
    await expect(fetchFullPlaylist(PL, TOKEN, bad(JSON.stringify({ errors: [{ message: 'PersistedQueryNotFound' }] })), noWait)).rejects.toThrow('PersistedQueryNotFound');
    await expect(fetchFullPlaylist(PL, TOKEN, bad(JSON.stringify({ data: {} })), noWait)).rejects.toThrow('inesperado');
  });
  it('sin total declarado, para al recibir una página corta', async () => {
    const srv = makeFetch({
      pathfinder: off => ({ ok: true, status: 200, body: JSON.stringify({ data: { playlistV2: { content: { items: Array.from({ length: off === 0 ? 100 : 20 }, (_, i) => wpTrack(off + i + 1)) } } } }) }),
    });
    const r = await fetchFullPlaylist(PL, TOKEN, srv.fn, noWait);
    expect(r.tracks).toHaveLength(120);
    expect(r.complete).toBe(true);
  });
  it('respeta el tope de páginas', async () => {
    const srv = makeFetch({ total: 1_000_000 });
    const r = await fetchFullPlaylist(PL, TOKEN, srv.fn, noWait);
    expect(srv.pathfinderCalls()).toHaveLength(MAX_PAGES);
    expect(r.complete).toBe(false);
  });
});

describe('importSpotifyPlaylist con paginación experimental', () => {
  let db: Db;
  beforeEach(async () => { db = createTestDb(); await migrate(db); });

  it('embed de 100 → importa todas las canciones, en orden, sin marcar parcial', async () => {
    const srv = makeFetch({ total: 250 });
    const s = await importSpotifyPlaylist(db, PL, srv.fn, noWait);
    expect(s).toMatchObject({ total: 250, newTracks: 250, partial: false, expanded: true });
    const entries = await getPlaylistEntries(db, s.playlistId);
    expect(entries).toHaveLength(250);
    expect(entries[0].track.title).toBe('Canción 1');
    expect(entries[249].track.title).toBe('Canción 250');
    expect(entries[249].track.artists).toEqual(['Uno', 'Dos']);
  });
  it('no se activa si el embed trae menos de 100', async () => {
    const srv = makeFetch({ embedCount: 40 });
    const s = await importSpotifyPlaylist(db, PL, srv.fn, noWait);
    expect(srv.pathfinderCalls()).toHaveLength(0);
    expect(s).toMatchObject({ total: 40, partial: false, expanded: false });
  });
  it('sin token: se queda con las 100 y sigue parcial', async () => {
    const srv = makeFetch({ token: null });
    const s = await importSpotifyPlaylist(db, PL, srv.fn, noWait);
    expect(srv.pathfinderCalls()).toHaveLength(0);
    expect(s).toMatchObject({ total: 100, partial: true, expanded: false });
    expect(s.expandNote).toContain('token');
  });
  it.each<[string, () => Reply | Error]>([
    ['HTTP 403', () => ({ ok: false, status: 403, body: '' })],
    ['429', () => ({ ok: false, status: 429, body: '' })],
    ['JSON roto', () => ({ ok: true, status: 200, body: '{roto' })],
    ['hash caducado', () => ({ ok: true, status: 200, body: JSON.stringify({ errors: [{ message: 'PersistedQueryNotFound' }] }) })],
    ['error de red', () => new Error('offline')],
  ])('si falla (%s) conserva las 100 del embed sin lanzar', async (_name: string, pathfinder: () => Reply | Error) => {
    const s = await importSpotifyPlaylist(db, PL, makeFetch({ pathfinder }).fn, noWait);
    expect(s).toMatchObject({ total: 100, newTracks: 100, partial: true, expanded: false });
    expect(s.expandNote).toBeTruthy();
    expect(await getPlaylistEntries(db, s.playlistId)).toHaveLength(100);
  });
  it('si no aporta más que el embed, lo ignora', async () => {
    const s = await importSpotifyPlaylist(db, PL, makeFetch({ total: 100 }).fn, noWait);
    expect(s).toMatchObject({ total: 100, expanded: false });
  });
  it('si se corta a mitad, usa lo obtenido y sigue marcada como parcial', async () => {
    const srv = makeFetch({ total: 350, pathfinder: off => (off >= 200 ? { ok: false, status: 500, body: '' } : undefined) });
    const s = await importSpotifyPlaylist(db, PL, srv.fn, noWait);
    expect(s).toMatchObject({ total: 200, partial: true, expanded: true });
    expect(s.expandNote).toContain('500');
  });
  it('reimportar no duplica canciones ni playlist', async () => {
    const a = await importSpotifyPlaylist(db, PL, makeFetch({ total: 150 }).fn, noWait);
    const b = await importSpotifyPlaylist(db, PL, makeFetch({ total: 150 }).fn, noWait);
    expect(b.playlistId).toBe(a.playlistId);
    expect(b.newTracks).toBe(0);
    const n = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM tracks');
    expect(n?.n).toBe(150);
  });
});
