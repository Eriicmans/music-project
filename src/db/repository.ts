import { Track, TrackCandidate, TrackVersion } from '../models/Track';
import { MatchResult } from '../core/matching/scoreCandidate';
import { Db } from './database';

export type MatchStatus = 'auto' | 'manual' | 'pending' | 'none';
export interface ScoredCandidate { candidate: TrackCandidate; result: MatchResult }
export interface StoredCandidate extends TrackCandidate { score: number; decision: string; reasons: string[]; conflicts: string[]; warnings: string[] }

const MAX_CANDIDATES = 5;
const now = () => Date.now();
export const newId = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

interface TrackRow {
  id: string; spotify_id: string | null; title: string; artists: string; album: string | null;
  duration_ms: number | null; isrc: string | null; version: string; musicbrainz_id: string | null;
  youtube_id: string | null;
}
const toTrack = (r: TrackRow): Track => ({
  id: r.id, title: r.title, artists: JSON.parse(r.artists) as string[],
  album: r.album ?? undefined, durationMs: r.duration_ms ?? undefined, isrc: r.isrc ?? undefined,
  version: r.version as TrackVersion,
  externalIds: {
    spotify: r.spotify_id ?? undefined, youtubeVideo: r.youtube_id ?? undefined,
    musicBrainzRecording: r.musicbrainz_id ?? undefined,
  },
});

/** Inserta la canción o actualiza la existente (clave: id de Spotify). Devuelve el id interno. */
export async function upsertTrack(db: Db, track: Track): Promise<string> {
  const spotify = track.externalIds.spotify ?? null;
  if (spotify) {
    const existing = await db.getFirstAsync<{ id: string }>('SELECT id FROM tracks WHERE spotify_id = ?', [spotify]);
    if (existing) {
      await db.runAsync(
        'UPDATE tracks SET title=?, artists=?, album=?, duration_ms=?, isrc=?, version=? WHERE id=?',
        [track.title, JSON.stringify(track.artists), track.album ?? null, track.durationMs ?? null,
         track.isrc ?? null, track.version, existing.id]);
      return existing.id;
    }
  }
  await db.runAsync(
    `INSERT INTO tracks (id, spotify_id, title, artists, album, duration_ms, isrc, version, musicbrainz_id, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [track.id, spotify, track.title, JSON.stringify(track.artists), track.album ?? null,
     track.durationMs ?? null, track.isrc ?? null, track.version,
     track.externalIds.musicBrainzRecording ?? null, now()]);
  return track.id;
}

export async function getTrack(db: Db, id: string): Promise<Track | null> {
  const row = await db.getFirstAsync<TrackRow>('SELECT * FROM tracks WHERE id = ?', [id]);
  return row ? toTrack(row) : null;
}

/**
 * Guarda una playlist y el orden de sus canciones. Reimportar la misma playlist
 * (mismo spotifyId) la actualiza en vez de duplicarla. Al reimportar:
 *  - las canciones añadidas a mano (sin id de Spotify) se conservan al final;
 *  - las canciones que ya no están en Spotify y no pertenecen a otra playlist se borran.
 */
export async function savePlaylist(
  db: Db,
  playlist: { name: string; spotifyId?: string; sourceUrl?: string },
  trackIds: string[],
): Promise<string> {
  let id: string | undefined;
  if (playlist.spotifyId) {
    id = (await db.getFirstAsync<{ id: string }>('SELECT id FROM playlists WHERE spotify_id = ?', [playlist.spotifyId]))?.id;
  }
  await db.execAsync('BEGIN');
  try {
    let finalIds = trackIds;
    let previous: string[] = [];
    if (id) {
      previous = (await db.getAllAsync<{ track_id: string }>(
        'SELECT track_id FROM playlist_tracks WHERE playlist_id = ?', [id])).map(r => r.track_id);
      const manual = await db.getAllAsync<{ track_id: string }>(
        `SELECT pt.track_id FROM playlist_tracks pt JOIN tracks t ON t.id = pt.track_id
         WHERE pt.playlist_id = ? AND t.spotify_id IS NULL ORDER BY pt.position`, [id]);
      const kept = manual.map(r => r.track_id).filter(t => !trackIds.includes(t));
      finalIds = [...trackIds, ...kept];
      await db.runAsync('UPDATE playlists SET name=?, source_url=? WHERE id=?', [playlist.name, playlist.sourceUrl ?? null, id]);
      await db.runAsync('DELETE FROM playlist_tracks WHERE playlist_id = ?', [id]);
    } else {
      id = newId();
      await db.runAsync('INSERT INTO playlists (id, spotify_id, name, source_url, created_at) VALUES (?,?,?,?,?)',
        [id, playlist.spotifyId ?? null, playlist.name, playlist.sourceUrl ?? null, now()]);
    }
    for (let i = 0; i < finalIds.length; i++) {
      await db.runAsync('INSERT INTO playlist_tracks (playlist_id, position, track_id) VALUES (?,?,?)', [id, i, finalIds[i]]);
    }
    await deleteOrphans(db, previous.filter(t => !finalIds.includes(t)));
    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
  return id;
}

/** Borra, de entre las canciones indicadas, las que ya no están en ninguna playlist (cascada a coincidencias y candidatos). */
async function deleteOrphans(db: Db, trackIds: string[]): Promise<void> {
  for (const t of trackIds) {
    await db.runAsync('DELETE FROM tracks WHERE id = ? AND id NOT IN (SELECT track_id FROM playlist_tracks)', [t]);
  }
}

/** Cambia el nombre de una playlist. */
export async function renamePlaylist(db: Db, playlistId: string, name: string): Promise<void> {
  const clean = name.trim();
  if (!clean) throw new Error('El nombre de la playlist no puede estar vacío');
  await db.runAsync('UPDATE playlists SET name = ? WHERE id = ?', [clean, playlistId]);
}

/**
 * Quita la canción que ocupa `position` en la playlist y recompone las posiciones.
 * Si la canción no está en ninguna otra playlist, se borra con sus coincidencias.
 * Devuelve false si no había nada en esa posición.
 */
export async function removeTrackFromPlaylist(db: Db, playlistId: string, position: number): Promise<boolean> {
  await db.execAsync('BEGIN');
  try {
    const rows = await db.getAllAsync<{ position: number; track_id: string }>(
      'SELECT position, track_id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position', [playlistId]);
    const target = rows.find(r => r.position === position);
    if (!target) { await db.execAsync('COMMIT'); return false; }
    const rest = rows.filter(r => r !== target).map(r => r.track_id);
    await db.runAsync('DELETE FROM playlist_tracks WHERE playlist_id = ?', [playlistId]);
    for (let i = 0; i < rest.length; i++) {
      await db.runAsync('INSERT INTO playlist_tracks (playlist_id, position, track_id) VALUES (?,?,?)', [playlistId, i, rest[i]]);
    }
    await deleteOrphans(db, [target.track_id]);
    await db.execAsync('COMMIT');
    return true;
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}

export interface PlaylistEntry { position: number; track: Track; status: MatchStatus | null; videoId: string | null }

export async function getPlaylistEntries(db: Db, playlistId: string): Promise<PlaylistEntry[]> {
  const rows = await db.getAllAsync<TrackRow & { position: number; m_status: string | null; m_video: string | null }>(
    `SELECT t.*, pt.position, m.status AS m_status, m.video_id AS m_video
     FROM playlist_tracks pt JOIN tracks t ON t.id = pt.track_id
     LEFT JOIN matches m ON m.track_id = t.id
     WHERE pt.playlist_id = ? ORDER BY pt.position`, [playlistId]);
  return rows.map(r => ({ position: r.position, track: toTrack(r), status: r.m_status as MatchStatus | null, videoId: r.m_video }));
}

/** Caché: vídeo ya resuelto (auto o manual) para una canción de Spotify. */
export async function getCachedVideoId(db: Db, spotifyId: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ video_id: string }>(
    `SELECT m.video_id FROM matches m JOIN tracks t ON t.id = m.track_id
     WHERE t.spotify_id = ? AND m.status IN ('auto','manual') AND m.video_id IS NOT NULL`, [spotifyId]);
  return row?.video_id ?? null;
}

export async function getMatchStatus(db: Db, trackId: string): Promise<{ status: MatchStatus; videoId: string | null } | null> {
  const row = await db.getFirstAsync<{ status: string; video_id: string | null }>(
    'SELECT status, video_id FROM matches WHERE track_id = ?', [trackId]);
  return row ? { status: row.status as MatchStatus, videoId: row.video_id } : null;
}

async function setMatch(db: Db, trackId: string, status: MatchStatus, videoId: string | null, score: number | null) {
  await db.runAsync(
    `INSERT INTO matches (track_id, video_id, status, score, updated_at) VALUES (?,?,?,?,?)
     ON CONFLICT(track_id) DO UPDATE SET video_id=excluded.video_id, status=excluded.status,
       score=excluded.score, updated_at=excluded.updated_at`,
    [trackId, videoId, status, score, now()]);
}

/**
 * Registra el resultado del matching de una canción. Una decisión manual
 * previa del usuario nunca se sobrescribe.
 */
export async function recordMatching(db: Db, trackId: string, scored: ScoredCandidate[]): Promise<MatchStatus> {
  const current = await getMatchStatus(db, trackId);
  if (current?.status === 'manual') return 'manual';

  const usable = scored
    .filter(s => s.result.decision !== 'reject')
    .sort((a, b) => b.result.score - a.result.score)
    .slice(0, MAX_CANDIDATES);

  await db.runAsync('DELETE FROM candidates WHERE track_id = ?', [trackId]);
  for (const { candidate: c, result: r } of usable) {
    await db.runAsync(
      `INSERT INTO candidates (track_id, provider, external_id, title, artists, duration_ms, version,
         score, decision, reasons, conflicts, warnings) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [trackId, c.provider, c.externalId, c.title, JSON.stringify(c.artists), c.durationMs ?? null, c.version,
       r.score, r.decision, JSON.stringify(r.reasons), JSON.stringify(r.conflicts), JSON.stringify(r.warnings)]);
  }

  const best = usable[0];
  if (best && best.result.decision === 'auto' && best.candidate.provider === 'youtube') {
    await setMatch(db, trackId, 'auto', best.candidate.externalId, best.result.score);
    return 'auto';
  }
  if (usable.length > 0) {
    await setMatch(db, trackId, 'pending', null, best.result.score);
    return 'pending';
  }
  await setMatch(db, trackId, 'none', null, null);
  return 'none';
}

/** El usuario elige un vídeo concreto para una canción. */
export async function resolveManual(db: Db, trackId: string, videoId: string): Promise<void> {
  await setMatch(db, trackId, 'manual', videoId, null);
}

/**
 * El usuario elige un vídeo salido de una búsqueda manual (puede no estar entre
 * los candidatos guardados). Se guarda como candidato y como coincidencia manual,
 * de modo que la playlist pueda mostrar y reproducir el vídeo elegido.
 */
export async function resolveManualFromSearch(
  db: Db, trackId: string, candidate: TrackCandidate, result: MatchResult,
): Promise<void> {
  await db.execAsync('BEGIN');
  try {
    await db.runAsync(
      `INSERT OR REPLACE INTO candidates (track_id, provider, external_id, title, artists, duration_ms, version,
         score, decision, reasons, conflicts, warnings) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [trackId, candidate.provider, candidate.externalId, candidate.title, JSON.stringify(candidate.artists),
       candidate.durationMs ?? null, candidate.version, result.score, result.decision,
       JSON.stringify(result.reasons), JSON.stringify(result.conflicts), JSON.stringify(result.warnings)]);
    await setMatch(db, trackId, 'manual', candidate.externalId, null);
    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}

export interface PendingReview { track: Track; candidates: StoredCandidate[] }

export async function listPendingReviews(db: Db): Promise<PendingReview[]> {
  const rows = await db.getAllAsync<TrackRow>(
    `SELECT t.* FROM tracks t JOIN matches m ON m.track_id = t.id
     WHERE m.status = 'pending' ORDER BY t.created_at, t.title`);
  const out: PendingReview[] = [];
  for (const row of rows) {
    const cands = await db.getAllAsync<{
      provider: string; external_id: string; title: string; artists: string; duration_ms: number | null;
      version: string; score: number; decision: string; reasons: string; conflicts: string; warnings: string;
    }>('SELECT * FROM candidates WHERE track_id = ? ORDER BY score DESC', [row.id]);
    out.push({
      track: toTrack(row),
      candidates: cands.map(c => ({
        provider: c.provider as TrackCandidate['provider'], externalId: c.external_id, title: c.title,
        artists: JSON.parse(c.artists), durationMs: c.duration_ms ?? undefined, version: c.version as TrackVersion,
        score: c.score, decision: c.decision, reasons: JSON.parse(c.reasons),
        conflicts: JSON.parse(c.conflicts), warnings: JSON.parse(c.warnings),
      })),
    });
  }
  return out;
}

export async function countByStatus(db: Db): Promise<Record<string, number>> {
  const rows = await db.getAllAsync<{ status: string; n: number }>('SELECT status, COUNT(*) AS n FROM matches GROUP BY status');
  const out: Record<string, number> = {};
  for (const r of rows) out[r.status] = r.n;
  return out;
}

export interface ChosenVideo { title: string; artists: string[]; durationMs?: number }

/** Vídeo elegido (auto o manual) de cada canción de una playlist, indexado por id de canción. */
export async function getChosenVideos(db: Db, playlistId: string): Promise<Record<string, ChosenVideo>> {
  const rows = await db.getAllAsync<{ track_id: string; title: string; artists: string; duration_ms: number | null }>(
    `SELECT pt.track_id, c.title, c.artists, c.duration_ms
     FROM playlist_tracks pt
     JOIN matches m ON m.track_id = pt.track_id AND m.status IN ('auto','manual') AND m.video_id IS NOT NULL
     JOIN candidates c ON c.track_id = m.track_id AND c.provider = 'youtube' AND c.external_id = m.video_id
     WHERE pt.playlist_id = ?`, [playlistId]);
  const out: Record<string, ChosenVideo> = {};
  for (const r of rows) {
    out[r.track_id] = { title: r.title, artists: JSON.parse(r.artists) as string[], durationMs: r.duration_ms ?? undefined };
  }
  return out;
}

/** El usuario descarta todos los candidatos de una canción (queda 'none'; una nueva búsqueda puede reintentarla). */
export async function markNone(db: Db, trackId: string): Promise<void> {
  await setMatch(db, trackId, 'none', null, null);
}

export interface PlaylistInfo { id: string; name: string; total: number; resolved: number; pending: number }

/** Playlists guardadas, las más recientes primero, con su progreso de matching. */
export async function listPlaylists(db: Db): Promise<PlaylistInfo[]> {
  return db.getAllAsync<PlaylistInfo>(
    `SELECT p.id AS id, p.name AS name,
            COUNT(pt.track_id) AS total,
            COALESCE(SUM(CASE WHEN m.status IN ('auto','manual') THEN 1 ELSE 0 END), 0) AS resolved,
            COALESCE(SUM(CASE WHEN m.status = 'pending' THEN 1 ELSE 0 END), 0) AS pending
     FROM playlists p
     LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
     LEFT JOIN matches m ON m.track_id = pt.track_id
     GROUP BY p.id ORDER BY p.created_at DESC, p.name`);
}

/**
 * Borra una playlist y las canciones que ya no están en ninguna otra
 * (con sus coincidencias y candidatos). Las canciones compartidas se conservan.
 */
export async function deletePlaylist(db: Db, playlistId: string): Promise<void> {
  await db.execAsync('BEGIN');
  try {
    await db.runAsync('DELETE FROM playlists WHERE id = ?', [playlistId]);
    await db.execAsync('DELETE FROM tracks WHERE id NOT IN (SELECT track_id FROM playlist_tracks)');
    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}

/** Crea una playlist propia (sin origen en Spotify). Devuelve su id. */
export async function createPlaylist(db: Db, name: string): Promise<string> {
  const clean = name.trim();
  if (!clean) throw new Error('El nombre de la playlist no puede estar vacío');
  const id = newId();
  await db.runAsync('INSERT INTO playlists (id, spotify_id, name, source_url, created_at) VALUES (?,NULL,?,NULL,?)',
    [id, clean, now()]);
  return id;
}

export interface YoutubeTrackInput {
  videoId: string; title: string; artists: string[]; album?: string; durationMs?: number; version: TrackVersion;
}

/**
 * Añade al final de una playlist una canción encontrada en la búsqueda.
 * La canción se identifica por su vídeo (no se duplica entre playlists) y queda
 * con el vídeo ya elegido (coincidencia manual). Si ya estaba en esa playlist no se repite.
 */
export async function addYoutubeTrackToPlaylist(
  db: Db, playlistId: string, t: YoutubeTrackInput,
): Promise<{ added: boolean; trackId: string }> {
  await db.execAsync('BEGIN');
  try {
    const existing = await db.getFirstAsync<{ id: string }>('SELECT id FROM tracks WHERE youtube_id = ?', [t.videoId]);
    const trackId = existing?.id ?? newId();
    if (!existing) {
      await db.runAsync(
        `INSERT INTO tracks (id, spotify_id, title, artists, album, duration_ms, isrc, version, musicbrainz_id, youtube_id, created_at)
         VALUES (?,NULL,?,?,?,?,NULL,?,NULL,?,?)`,
        [trackId, t.title, JSON.stringify(t.artists), t.album ?? null, t.durationMs ?? null, t.version, t.videoId, now()]);
    }
    const dup = await db.getFirstAsync<{ track_id: string }>(
      'SELECT track_id FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?', [playlistId, trackId]);
    if (dup) { await db.execAsync('COMMIT'); return { added: false, trackId }; }

    const next = await db.getFirstAsync<{ n: number }>(
      'SELECT COALESCE(MAX(position), -1) + 1 AS n FROM playlist_tracks WHERE playlist_id = ?', [playlistId]);
    await db.runAsync('INSERT INTO playlist_tracks (playlist_id, position, track_id) VALUES (?,?,?)',
      [playlistId, next?.n ?? 0, trackId]);
    await db.runAsync(
      `INSERT OR REPLACE INTO candidates (track_id, provider, external_id, title, artists, duration_ms, version,
         score, decision, reasons, conflicts, warnings) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [trackId, 'youtube', t.videoId, t.title, JSON.stringify(t.artists), t.durationMs ?? null, t.version,
       100, 'auto', JSON.stringify(['elegida desde la búsqueda']), '[]', '[]']);
    await setMatch(db, trackId, 'manual', t.videoId, null);
    await db.execAsync('COMMIT');
    return { added: true, trackId };
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}