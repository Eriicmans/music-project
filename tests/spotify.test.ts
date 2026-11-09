import { beforeEach, describe, expect, it } from 'vitest';
import { Db } from '../src/db/database';
import { migrate } from '../src/db/migrations';
import { getPlaylistEntries } from '../src/db/repository';
import { ImportError } from '../src/importers/errors';
import { artistsFromSubtitle, parseEmbedHtml } from '../src/importers/spotify/embed';
import { importSpotifyPlaylist } from '../src/importers/spotify/importPlaylist';
import { parsePlaylistId } from '../src/importers/spotify/parseUrl';
import { createTestDb } from './helpers/nodeSqliteDb';

const PL = '37i9dQZF1DXcBWIGoYBM5M';
const sid = (n: number) => String(n).padStart(22, 'A');
const item = (n: number, o: Record<string, unknown> = {}) => ({
  uri: `spotify:track:${sid(n)}`, title: `Canción ${n}`, subtitle: 'Artista Uno,\u00a0Artista Dos', duration: 200000 + n, ...o,
});
const html = (entity: unknown) =>
  `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: { pageProps: { state: { data: { entity } } } },
  })}</script></html>`;
const okFetch = (body: string) => async () => ({ ok: true, status: 200, text: async () => body });

const codeOf = (fn: () => unknown) => { try { fn(); } catch (e) { return (e as ImportError).code; } return null; };

describe('parsePlaylistId', () => {
  it.each([
    [`https://open.spotify.com/playlist/${PL}`],
    [`https://open.spotify.com/playlist/${PL}?si=abc123def`],
    [`https://open.spotify.com/intl-es/playlist/${PL}`],
    [`  https://open.spotify.com/embed/playlist/${PL}  `],
    [`https://open.spotify.com/user/someone/playlist/${PL}`],
    [`spotify:playlist:${PL}`],
    [PL],
  ])('acepta %s', input => expect(parsePlaylistId(input)).toBe(PL));

  it('rechaza lo que no es una playlist', () => {
    expect(codeOf(() => parsePlaylistId(`https://open.spotify.com/album/${PL}`))).toBe('not_playlist');
    expect(codeOf(() => parsePlaylistId(`https://open.spotify.com/track/${PL}`))).toBe('not_playlist');
    expect(codeOf(() => parsePlaylistId('https://spotify.link/abc123'))).toBe('short_link');
    expect(codeOf(() => parsePlaylistId('hola'))).toBe('invalid_url');
    expect(codeOf(() => parsePlaylistId(''))).toBe('invalid_url');
  });
});

describe('parseEmbedHtml', () => {
  it('lee nombre, canciones, artistas y duración', () => {
    const r = parseEmbedHtml(html({ name: 'Mi lista', trackList: [item(1), item(2)] }));
    expect(r.name).toBe('Mi lista');
    expect(r.tracks).toHaveLength(2);
    expect(r.tracks[0]).toEqual({ spotifyId: sid(1), title: 'Canción 1', artists: ['Artista Uno', 'Artista Dos'], durationMs: 200001 });
    expect(r.partial).toBe(false);
  });
  it('omite archivos locales y episodios, y los cuenta', () => {
    const r = parseEmbedHtml(html({ name: 'x', trackList: [item(1), item(2, { uri: 'spotify:local:a:b:c:d' }), item(3, { uri: `spotify:episode:${sid(3)}` })] }));
    expect(r.tracks).toHaveLength(1);
    expect(r.skipped).toBe(2);
  });
  it('avisa de lista parcial al llegar a 100', () => {
    const list = Array.from({ length: 100 }, (_, i) => item(i + 1));
    expect(parseEmbedHtml(html({ name: 'x', trackList: list })).partial).toBe(true);
  });
  it('tolera que trackList esté en otro sitio del JSON', () => {
    const page = `<script id="__NEXT_DATA__">${JSON.stringify({ a: { b: { trackList: [item(1)] } } })}</script>`;
    expect(parseEmbedHtml(page).tracks).toHaveLength(1);
  });
  it('errores claros: entidad nula y página sin datos', () => {
    expect(codeOf(() => parseEmbedHtml(html(null)))).toBe('unavailable');
    expect(codeOf(() => parseEmbedHtml('<html>nada</html>'))).toBe('parse');
    expect(codeOf(() => parseEmbedHtml('<script id="__NEXT_DATA__">{roto</script>'))).toBe('parse');
  });
  it('artistas separados por coma, con espacios duros', () => {
    expect(artistsFromSubtitle('A,\u00a0B, C')).toEqual(['A', 'B', 'C']);
    expect(artistsFromSubtitle(undefined)).toEqual([]);
  });
});

describe('importSpotifyPlaylist', () => {
  let db: Db;
  beforeEach(async () => { db = createTestDb(); await migrate(db); });
  const page = html({ name: 'Mi lista', trackList: [item(1), item(2, { title: 'Tema (Live at Wembley)' }), item(3)] });

  it('guarda canciones en orden, con versión detectada', async () => {
    const s = await importSpotifyPlaylist(db, `https://open.spotify.com/playlist/${PL}`, okFetch(page));
    expect(s).toMatchObject({ name: 'Mi lista', total: 3, newTracks: 3, partial: false });
    const entries = await getPlaylistEntries(db, s.playlistId);
    expect(entries.map(e => e.track.title)).toEqual(['Canción 1', 'Tema (Live at Wembley)', 'Canción 3']);
    expect(entries[1].track.version).toBe('live');
    expect(entries[0].track.version).toBe('studio');
  });
  it('reimportar no duplica ni canciones ni playlist', async () => {
    const a = await importSpotifyPlaylist(db, PL, okFetch(page));
    const b = await importSpotifyPlaylist(db, PL, okFetch(page));
    expect(b.playlistId).toBe(a.playlistId);
    expect(b.newTracks).toBe(0);
    const n = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM tracks');
    expect(n?.n).toBe(3);
  });
  it('una canción repetida en otra playlist reutiliza la misma fila', async () => {
    await importSpotifyPlaylist(db, PL, okFetch(page));
    const other = html({ name: 'Otra', trackList: [item(1), item(9)] });
    const s = await importSpotifyPlaylist(db, 'A'.repeat(22), okFetch(other));
    expect(s.newTracks).toBe(1);
  });
  it('traduce errores de red y de HTTP', async () => {
    const boom = async () => { throw new Error('offline'); };
    await expect(importSpotifyPlaylist(db, PL, boom)).rejects.toMatchObject({ code: 'network' });
    const nf = async () => ({ ok: false, status: 404, text: async () => '' });
    await expect(importSpotifyPlaylist(db, PL, nf)).rejects.toMatchObject({ code: 'unavailable' });
    const e500 = async () => ({ ok: false, status: 500, text: async () => '' });
    await expect(importSpotifyPlaylist(db, PL, e500)).rejects.toMatchObject({ code: 'network' });
  });
});
