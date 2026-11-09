import { Db } from '../../db/database';
import { newId, savePlaylist, upsertTrack } from '../../db/repository';
import { parseTitle } from '../../core/matching/parseTitle';
import { Track } from '../../models/Track';
import { fetchEmbedPlaylist, FetchFn } from './embed';
import { parsePlaylistId } from './parseUrl';

export interface ImportSummary {
  playlistId: string;
  name: string;
  total: number;
  newTracks: number;
  skipped: number;
  /** Puede haber más canciones de las importadas (tope del embed). */
  partial: boolean;
}

/** Importa una playlist pública de Spotify a la base de datos local. */
export async function importSpotifyPlaylist(db: Db, input: string, fetchFn: FetchFn = fetch as unknown as FetchFn): Promise<ImportSummary> {
  const spotifyPlaylistId = parsePlaylistId(input);
  const playlist = await fetchEmbedPlaylist(spotifyPlaylistId, fetchFn);

  const ids: string[] = [];
  let newTracks = 0;
  await db.execAsync('BEGIN');
  try {
    for (const t of playlist.tracks) {
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
  return { playlistId, name: playlist.name, total: ids.length, newTracks, skipped: playlist.skipped, partial: playlist.partial };
}
