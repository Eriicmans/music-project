import { TrackVersion } from '../models/Track';
import { Db } from './database';
import { newId } from './repository';

/**
 * Copia de seguridad en JSON de la biblioteca (playlists, canciones y vídeos ya elegidos).
 * No incluye candidatos dudosos ni canciones sin resolver: tras restaurar basta con
 * pulsar "Buscar coincidencias" para recuperarlos.
 */
export const BACKUP_FORMAT = 'music-project-backup';
export const BACKUP_VERSION = 1;

export interface BackupTrack {
  ref: string;
  spotifyId?: string;
  youtubeId?: string;
  title: string;
  artists: string[];
  album?: string;
  durationMs?: number;
  isrc?: string;
  version: TrackVersion;
  match?: {
    status: 'auto' | 'manual';
    videoId: string;
    candidate?: { title: string; artists: string[]; durationMs?: number; version: TrackVersion };
  };
}
export interface BackupPlaylist {
  name: string;
  spotifyId?: string;
  sourceUrl?: string;
  createdAt: number;
  /** Referencias (`ref`) de las canciones, en orden. */
  tracks: string[];
}
export interface BackupData {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: number;
  tracks: BackupTrack[];
  playlists: BackupPlaylist[];
}

export interface RestoreSummary {
  playlists: number;
  skippedPlaylists: number;
  tracks: number;
  matches: number;
}

/* ---------- Exportar ---------- */

export async function exportLibrary(db: Db): Promise<BackupData> {
  const playlists = await db.getAllAsync<{ id: string; spotify_id: string | null; name: string; source_url: string | null; created_at: number }>(
    'SELECT id, spotify_id, name, source_url, created_at FROM playlists ORDER BY created_at, name');
  const outPlaylists: BackupPlaylist[] = [];
  for (const p of playlists) {
    const rows = await db.getAllAsync<{ track_id: string }>(
      'SELECT track_id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position', [p.id]);
    outPlaylists.push({
      name: p.name, spotifyId: p.spotify_id ?? undefined, sourceUrl: p.source_url ?? undefined,
      createdAt: p.created_at, tracks: rows.map(r => r.track_id),
    });
  }

  const rows = await db.getAllAsync<{
    id: string; spotify_id: string | null; youtube_id: string | null; title: string; artists: string;
    album: string | null; duration_ms: number | null; isrc: string | null; version: string;
    m_status: string | null; m_video: string | null;
    c_title: string | null; c_artists: string | null; c_duration: number | null; c_version: string | null;
  }>(
    `SELECT t.id, t.spotify_id, t.youtube_id, t.title, t.artists, t.album, t.duration_ms, t.isrc, t.version,
            m.status AS m_status, m.video_id AS m_video,
            c.title AS c_title, c.artists AS c_artists, c.duration_ms AS c_duration, c.version AS c_version
     FROM tracks t
     LEFT JOIN matches m ON m.track_id = t.id AND m.status IN ('auto','manual') AND m.video_id IS NOT NULL
     LEFT JOIN candidates c ON c.track_id = t.id AND c.provider = 'youtube' AND c.external_id = m.video_id
     WHERE t.id IN (SELECT track_id FROM playlist_tracks)
     ORDER BY t.created_at, t.id`);

  const tracks: BackupTrack[] = rows.map(r => {
    const t: BackupTrack = {
      ref: r.id, spotifyId: r.spotify_id ?? undefined, youtubeId: r.youtube_id ?? undefined,
      title: r.title, artists: JSON.parse(r.artists) as string[], album: r.album ?? undefined,
      durationMs: r.duration_ms ?? undefined, isrc: r.isrc ?? undefined, version: r.version as TrackVersion,
    };
    if (r.m_status && r.m_video) {
      t.match = {
        status: r.m_status as 'auto' | 'manual', videoId: r.m_video,
        candidate: r.c_title
          ? {
            title: r.c_title, artists: JSON.parse(r.c_artists ?? '[]') as string[],
            durationMs: r.c_duration ?? undefined, version: (r.c_version ?? 'unknown') as TrackVersion,
          }
          : undefined,
      };
    }
    return t;
  });

  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: Date.now(), tracks, playlists: outPlaylists };
}

/* ---------- Validar ---------- */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);
const optStr = (v: unknown) => v === undefined || v === null || isStr(v);
const optNum = (v: unknown) => v === undefined || v === null || (typeof v === 'number' && Number.isFinite(v));

/** Lee y valida el texto de una copia. Lanza un Error con un mensaje claro si no es válida. */
export function parseBackup(text: string): BackupData {
  let raw: unknown;
  try { raw = JSON.parse(text.trim()); } catch { throw new Error('El texto no es una copia válida (no es JSON).'); }
  if (!isObj(raw) || raw.format !== BACKUP_FORMAT) throw new Error('El texto no es una copia de Music Project.');
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) {
    throw new Error('La copia es de una versión más nueva de la app.');
  }
  if (!Array.isArray(raw.tracks) || !Array.isArray(raw.playlists)) throw new Error('La copia está incompleta.');

  const refs = new Set<string>();
  for (const t of raw.tracks) {
    if (!isObj(t) || !isStr(t.ref) || !isStr(t.title) || !isStrArr(t.artists) || !isStr(t.version)
      || !optStr(t.spotifyId) || !optStr(t.youtubeId) || !optStr(t.album) || !optStr(t.isrc) || !optNum(t.durationMs)) {
      throw new Error('La copia tiene una canción con datos incorrectos.');
    }
    if (t.match !== undefined && t.match !== null) {
      const m = t.match;
      if (!isObj(m) || (m.status !== 'auto' && m.status !== 'manual') || !isStr(m.videoId)) {
        throw new Error('La copia tiene una coincidencia con datos incorrectos.');
      }
      const c = m.candidate;
      if (c !== undefined && c !== null
        && (!isObj(c) || !isStr(c.title) || !isStrArr(c.artists) || !isStr(c.version) || !optNum(c.durationMs))) {
        throw new Error('La copia tiene un vídeo elegido con datos incorrectos.');
      }
    }
    refs.add(t.ref);
  }
  for (const p of raw.playlists) {
    if (!isObj(p) || !isStr(p.name) || !isStrArr(p.tracks) || !optStr(p.spotifyId) || !optStr(p.sourceUrl)
      || typeof p.createdAt !== 'number') {
      throw new Error('La copia tiene una playlist con datos incorrectos.');
    }
    if (p.tracks.some(r => !refs.has(r))) throw new Error('Una playlist de la copia usa una canción que no existe.');
  }
  return raw as unknown as BackupData;
}

/* ---------- Restaurar ---------- */

/**
 * Fusiona una copia con la biblioteca actual; nunca borra ni pisa nada:
 *  - una playlist de Spotify que ya existe se omite; una propia se omite si ya hay otra con el mismo nombre;
 *  - las canciones ya presentes (mismo id de Spotify o de YouTube) se reutilizan;
 *  - la coincidencia de una canción solo se restaura si esa canción aún no tiene ninguna.
 */
export async function importLibrary(db: Db, data: BackupData): Promise<RestoreSummary> {
  const summary: RestoreSummary = { playlists: 0, skippedPlaylists: 0, tracks: 0, matches: 0 };
  const idOf = new Map<string, string>();

  await db.execAsync('BEGIN');
  try {
    // Primero se decide qué playlists entran; solo se restauran las canciones que usan (así no quedan huérfanas).
    const toImport: BackupPlaylist[] = [];
    for (const p of data.playlists) {
      const exists = p.spotifyId
        ? await db.getFirstAsync<{ id: string }>('SELECT id FROM playlists WHERE spotify_id = ?', [p.spotifyId])
        : await db.getFirstAsync<{ id: string }>('SELECT id FROM playlists WHERE spotify_id IS NULL AND name = ?', [p.name]);
      if (exists) summary.skippedPlaylists++; else toImport.push(p);
    }
    const needed = new Set(toImport.flatMap(p => p.tracks));

    for (const t of data.tracks) {
      if (!needed.has(t.ref)) continue;
      let id: string | undefined;
      if (t.spotifyId) id = (await db.getFirstAsync<{ id: string }>('SELECT id FROM tracks WHERE spotify_id = ?', [t.spotifyId]))?.id;
      if (!id && t.youtubeId) id = (await db.getFirstAsync<{ id: string }>('SELECT id FROM tracks WHERE youtube_id = ?', [t.youtubeId]))?.id;
      if (!id) {
        id = newId();
        await db.runAsync(
          `INSERT INTO tracks (id, spotify_id, title, artists, album, duration_ms, isrc, version, musicbrainz_id, youtube_id, created_at)
           VALUES (?,?,?,?,?,?,?,?,NULL,?,?)`,
          [id, t.spotifyId ?? null, t.title, JSON.stringify(t.artists), t.album ?? null, t.durationMs ?? null,
           t.isrc ?? null, t.version, t.youtubeId ?? null, Date.now()]);
        summary.tracks++;
      }
      idOf.set(t.ref, id);

      if (t.match) {
        const has = await db.getFirstAsync<{ track_id: string }>('SELECT track_id FROM matches WHERE track_id = ?', [id]);
        if (!has) {
          const c = t.match.candidate;
          await db.runAsync(
            `INSERT OR REPLACE INTO candidates (track_id, provider, external_id, title, artists, duration_ms, version,
               score, decision, reasons, conflicts, warnings) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            [id, 'youtube', t.match.videoId, c?.title ?? t.title, JSON.stringify(c?.artists ?? t.artists),
             c?.durationMs ?? null, c?.version ?? t.version, 100, 'auto', JSON.stringify(['restaurada de una copia']), '[]', '[]']);
          await db.runAsync(
            'INSERT INTO matches (track_id, video_id, status, score, updated_at) VALUES (?,?,?,NULL,?)',
            [id, t.match.videoId, t.match.status, Date.now()]);
          summary.matches++;
        }
      }
    }

    for (const p of toImport) {
      const pid = newId();
      await db.runAsync('INSERT INTO playlists (id, spotify_id, name, source_url, created_at) VALUES (?,?,?,?,?)',
        [pid, p.spotifyId ?? null, p.name, p.sourceUrl ?? null, p.createdAt]);
      for (let i = 0; i < p.tracks.length; i++) {
        await db.runAsync('INSERT INTO playlist_tracks (playlist_id, position, track_id) VALUES (?,?,?)',
          [pid, i, idOf.get(p.tracks[i]) as string]);
      }
      summary.playlists++;
    }
    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
  return summary;
}
