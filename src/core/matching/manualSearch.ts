import { Track, TrackCandidate } from '../../models/Track';
import { MatchResult, scoreCandidate } from './scoreCandidate';
import { SearchFn } from './matchTrack';
import { YtResult, buildQuery } from '../../providers/youtubeMusic/search';
import { toCandidate } from '../../providers/youtubeMusic/toCandidate';

export interface ManualResult {
  candidate: TrackCandidate;
  result: MatchResult;
  kind: YtResult['kind'];
}

/** Texto inicial de la búsqueda manual: "artista título". */
export const defaultManualQuery = (track: Track): string => buildQuery(track.title, track.artists);

const MAX_RESULTS = 15;

/**
 * Búsqueda libre en YouTube Music para elegir a mano el vídeo de una canción.
 * Une "Canciones" y la búsqueda sin filtro (que trae directos, vídeos, etc.),
 * sin duplicados, y puntúa cada resultado contra la canción original solo
 * como orientación: aquí decide el usuario, así que no se descarta ninguno.
 * Si una de las dos búsquedas falla se usa la otra; si fallan ambas, lanza el error.
 */
export async function searchManual(track: Track, query: string, search: SearchFn): Promise<ManualResult[]> {
  const q = query.trim();
  if (!q) return [];

  const [songs, any] = await Promise.allSettled([search(q), search(q, { filter: false })]);
  if (songs.status === 'rejected' && any.status === 'rejected') throw songs.reason;

  const all: YtResult[] = [
    ...(songs.status === 'fulfilled' ? songs.value : []),
    ...(any.status === 'fulfilled' ? any.value : []),
  ];

  const seen = new Set<string>();
  const out: ManualResult[] = [];
  for (const r of all) {
    if (r.kind === 'other' || seen.has(r.videoId)) continue;
    seen.add(r.videoId);
    const candidate = toCandidate(r);
    out.push({ candidate, result: scoreCandidate(track, candidate), kind: r.kind });
  }
  return out
    .sort((a, b) => b.result.score - a.result.score || Number(b.kind === 'song') - Number(a.kind === 'song'))
    .slice(0, MAX_RESULTS);
}
