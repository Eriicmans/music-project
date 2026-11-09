import { Db } from '../../db/database';
import { newId, savePlaylist, upsertTrack } from '../../db/repository';
import { parseTitle } from '../../core/matching/parseTitle';
import { Track } from '../../models/Track';
import { EmbedPlaylist, EmbedTrack, fetchEmbedPlaylist, FetchFn } from './embed';
import { parsePlaylistId } from './parseUrl';
import { fetchFullPlaylist, WebPlayerOptions } from './webPlayer';

export interface ImportSummary {
  playlistId: string;
  name: string;
  total: number;
  newTracks: number;
  skipped: number;
  /** Puede haber más canciones de las importadas (tope del embed o paginación cortada). */
  partial: boolean;
  /** true si se amplió con la importación experimental del reproductor web (>100 canciones). */
  expanded: boolean;
  /** Motivo por el que la ampliación experimental no se aplicó o quedó a medias. */
  expandNote?: string;
}

interface Expansion { tracks: EmbedTrack[]; partial: boolean; note?: string }

/**
 * Solo si el embed llegó al tope (partial) y trae token anónimo. Nunca lanza: ante cualquier
 * fallo o resultado que no mejore al embed devuelve `note` y el importador se queda con las 100.
 */
async function tryExpand(playlistId: string, embed: EmbedPlaylist, fetchFn: FetchFn, opts: WebPlayerOptions)
  : Promise<Expansion | { note: string }> {
  if (!embed.accessToken) return { note: 'el embed no trae token anónimo' };
  try {
    const r = await fetchFullPlaylist(playlistId, embed.accessToken, fetchFn, opts);
    if (r.tracks.length <= embed.tracks.length) {
      return { note: r.reason ?? 'el servicio interno no devolvió más canciones que el embed' };
    }
    return { tracks: r.tracks, partial: !r.complete, note: r.complete ? undefined : r.reason };
  } catch (e) {
    return { note: (e as Error)?.message ?? 'error desconocido' };
  }
}

/** Importa una playlist pública de Spotify a la base de datos local. */
export async function importSpotifyPlaylist(
  db: Db, input: string, fetchFn: FetchFn = fetch as unknown as FetchFn, opts: WebPlayerOptions = {},
): Promise<ImportSummary> {
  const spotifyPlaylistId = parsePlaylistId(input);
  const playlist = await fetchEmbedPlaylist(spotifyPlaylistId, fetchFn);

  let source = playlist.tracks;
  let partial = playlist.partial;
  let expanded = false;
  let expandNote: string | undefined;
  if (playlist.partial) {
    const x = await tryExpand(spotifyPlaylistId, playlist, fetchFn, opts);
    if ('tracks' in x) { source = x.tracks; partial = x.partial; expanded = true; }
    expandNote = x.note;
  }

  const ids: string[] = [];
  let newTracks = 0;
  await db.execAsync('BEGIN');
  try {
    for (const t of source) {
      const track: Track = {
        id: newId(),
        title: t.title,
        artists: t.artists,
        durationMs: t.durationMs,
        version: parseTitle(t.title, t.artists).version,
        externalIds: { spotify: t.spotifyId },
      };
      const id = await upsertTrack(db, track);
      if (id === track.id) newTracks++;
      ids.push(id);
    }
    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }

  const playlistId = await savePlaylist(
    db,
    { name: playlist.name, spotifyId: spotifyPlaylistId, sourceUrl: input.trim() },
    ids,
  );
  return { playlistId, name: playlist.name, total: ids.length, newTracks, skipped: playlist.skipped, partial, expanded, expandNote };
}
