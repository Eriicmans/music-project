export interface YtResult {
  videoId: string;
  title: string;
  artists: string[];
  album?: string;
  durationSec?: number;
  kind: 'song' | 'video' | 'other';
}

export class SearchError extends Error {
  constructor(public code: 'network' | 'parse', message: string) {
    super(message);
  }
}

// Filtro "Canciones" de YT Music (valor de ytmusicapi; NO verificado hoy).
// Si no devuelve nada, el matching reintenta con filter:false.
export const SONGS_FILTER = 'EgWKAQIIAWoMEA4QChADEAQQCRAF';
const ENDPOINT = 'https://music.youtube.com/youtubei/v1/search?prettyPrint=false';

export function buildQuery(title: string, artists: string[]): string {
  return `${artists[0] ?? ''} ${title}`.trim();
}

export function buildSearchBody(query: string, params?: string) {
  return {
    context: { client: { clientName: 'WEB_REMIX', clientVersion: '1.20241127.01.00', hl: 'en' } },
    query,
    ...(params ? { params } : {}),
  };
}

export function parseDuration(s: string): number | undefined {
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return undefined;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

type Json = any;

function collectItems(node: Json, out: Json[]): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((n) => collectItems(n, out));
    return;
  }
  if (node.musicResponsiveListItemRenderer) {
    out.push(node.musicResponsiveListItemRenderer);
    return;
  }
  Object.values(node).forEach((v) => collectItems(v, out));
}

function pageType(run: Json): string | undefined {
  return run?.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs
    ?.browseEndpointContextMusicConfig?.pageType;
}

function findVideoId(node: Json): string | undefined {
  if (!node || typeof node !== 'object') return undefined;
  if (typeof node.videoId === 'string') return node.videoId;
  for (const v of Object.values(node)) {
    const f = findVideoId(v);
    if (f) return f;
  }
  return undefined;
}

function parseItem(r: Json): YtResult | null {
  const cols: Json[][] = (r.flexColumns ?? []).map(
    (c: Json) => c?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? [],
  );
  const title: string | undefined = cols[0]?.[0]?.text;
  const videoId: string | undefined = r.playlistItemData?.videoId ?? findVideoId(r);
  if (!title || !videoId) return null;

  const runs: Json[] = cols[1] ?? [];
  const artists: string[] = [];
  let album: string | undefined;
  let durationSec: number | undefined;
  const segments: string[] = [];
  let current = '';
  for (const run of runs) {
    const text: string = run?.text ?? '';
    if (text.trim() === '•') {
      segments.push(current.trim());
      current = '';
      continue;
    }
    current += text;
    const pt = pageType(run);
    if (pt === 'MUSIC_PAGE_TYPE_ARTIST' || pt === 'MUSIC_PAGE_TYPE_USER_CHANNEL') artists.push(text);
    else if (pt === 'MUSIC_PAGE_TYPE_ALBUM') album = text;
    const d = parseDuration(text);
    if (d !== undefined) durationSec = d;
  }
  if (current) segments.push(current.trim());

  const first = segments[0]?.toLowerCase();
  let kind: YtResult['kind'] = 'other';
  if (first === 'song' || album) kind = 'song';
  else if (first === 'video') kind = 'video';

  if (artists.length === 0) {
    const fallback = segments.find(
      (s) => !/^(song|video|album|single|ep)$/i.test(s) && parseDuration(s) === undefined,
    );
    if (fallback) artists.push(fallback);
  }
  return { videoId, title, artists, album, durationSec, kind };
}

export function parseSearchResponse(json: unknown): YtResult[] {
  const items: Json[] = [];
  collectItems(json, items);
  const seen = new Set<string>();
  const results: YtResult[] = [];
  for (const it of items) {
    const p = parseItem(it);
    if (p && !seen.has(p.videoId)) {
      seen.add(p.videoId);
      results.push(p);
    }
  }
  return results;
}

export async function searchYtMusic(
  query: string,
  opts: { fetchFn?: typeof fetch; filter?: boolean } = {},
): Promise<YtResult[]> {
  const fetchFn = opts.fetchFn ?? fetch;
  let res: Response;
  try {
    res = await fetchFn(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://music.youtube.com' },
      body: JSON.stringify(buildSearchBody(query, opts.filter === false ? undefined : SONGS_FILTER)),
    });
  } catch (e) {
    throw new SearchError('network', `Sin conexión con YouTube Music: ${(e as Error).message}`);
  }
  if (!res.ok) throw new SearchError('network', `YouTube Music respondió ${res.status}`);
  try {
    return parseSearchResponse(await res.json());
  } catch (e) {
    throw new SearchError('parse', `Respuesta no válida: ${(e as Error).message}`);
  }
}
