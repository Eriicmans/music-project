import { SearchFn } from '../matching/matchTrack';
import { YtResult } from '../../providers/youtubeMusic/search';

const MAX_RESULTS = 20;

/**
 * Búsqueda de canciones para la pestaña Buscar. Usa el filtro "Canciones" de
 * YouTube Music; si no devuelve nada (el filtro puede haber cambiado) reintenta
 * sin filtro y descarta lo que no sea canción ni vídeo. Sin duplicados.
 */
export async function searchSongs(query: string, search: SearchFn): Promise<YtResult[]> {
  const q = query.trim();
  if (!q) return [];
  let results = await search(q);
  if (results.length === 0) {
    results = (await search(q, { filter: false })).filter((r) => r.kind !== 'other');
  }
  const seen = new Set<string>();
  const out: YtResult[] = [];
  for (const r of results) {
    if (r.kind === 'other' || seen.has(r.videoId)) continue;
    seen.add(r.videoId);
    out.push(r);
  }
  return out.slice(0, MAX_RESULTS);
}
