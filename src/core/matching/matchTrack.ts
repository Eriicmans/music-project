import { Track, TrackCandidate } from '../../models/Track';
import { MatchResult, scoreCandidate } from './scoreCandidate';
import { YtResult, buildQuery } from '../../providers/youtubeMusic/search';
import { toCandidate } from '../../providers/youtubeMusic/toCandidate';

export interface ScoredCandidate {
  candidate: TrackCandidate;
  result: MatchResult;
}

export type SearchFn = (query: string, opts?: { filter?: boolean }) => Promise<YtResult[]>;

const RANK = { auto: 0, review: 1, reject: 2 } as const;

/**
 * Busca candidatos para una canción y los puntúa, mejores primero.
 * Si la búsqueda filtrada a "Canciones" no devuelve nada (el filtro puede
 * haber cambiado), reintenta sin filtro descartando resultados 'other'.
 */
export async function findCandidates(track: Track, search: SearchFn): Promise<ScoredCandidate[]> {
  const query = buildQuery(track.title, track.artists);
  let results = await search(query);
  if (results.length === 0) {
    results = (await search(query, { filter: false })).filter((r) => r.kind !== 'other');
  }
  return results
    .map(toCandidate)
    .map((candidate) => ({ candidate, result: scoreCandidate(track, candidate) }))
    .sort(
      (a, b) =>
        RANK[a.result.decision] - RANK[b.result.decision] || b.result.score - a.result.score,
    );
}
