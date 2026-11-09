import { EmbedTrack, FetchFn } from './embed';

/**
 * EXPERIMENTAL. Lee playlists completas por el servicio interno (pathfinder, operación
 * `fetchPlaylist`) que usa el reproductor web de Spotify, con el token anónimo que la
 * propia página embed ya entrega. No es una API pública y puede cambiar o bloquearse
 * en cualquier momento (sobre todo el hash de la consulta): por eso el importador solo
 * la usa cuando el embed llega al tope de 100 y, si algo falla, conserva las 100 del embed.
 */
export const PATHFINDER_URL = 'https://api-partner.spotify.com/pathfinder/v1/query';
/** Hash de la consulta persistida `fetchPlaylist` del reproductor web (nov 2026; rota con las versiones). */
export const FETCH_PLAYLIST_HASH = '8964e8eafb21aa992a7d951d256d83285c04be2105d209262901de70cb97584a';
export const PAGE_SIZE = 100;
/** Tope de seguridad: 50 páginas = 5000 canciones. */
export const MAX_PAGES = 50;
const TIMEOUT_MS = 15000;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export interface WebPlayerResult {
  tracks: EmbedTrack[];
  /** Total declarado por Spotify (si lo da). */
  total?: number;
  /** false si se cortó a mitad (error en una página posterior): hay canciones pero no todas. */
  complete: boolean;
  /** Motivo del corte cuando `complete` es false. */
  reason?: string;
}

export class WebPlayerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebPlayerError';
  }
}

export interface WebPlayerOptions {
  /** Pausa entre páginas (ms). Por defecto 300. */
  pageDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

type Json = any;
const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function withTimeout<T>(run: (signal: unknown) => Promise<T>): Promise<T> {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { ctl?.abort(); reject(new WebPlayerError('tiempo de espera agotado')); }, TIMEOUT_MS);
  });
  try { return await Promise.race([run(ctl?.signal), timeout]); }
  finally { if (timer) clearTimeout(timer); }
}

/** Convierte un elemento de la respuesta en canción; null si es un episodio, archivo local o no se entiende. */
export function mapItem(item: Json): EmbedTrack | null {
  const data: Json = item?.itemV2?.data ?? item?.item?.data ?? item?.data ?? item;
  const uri = data?.uri;
  const m = typeof uri === 'string' ? /^spotify:track:([A-Za-z0-9]{22})$/.exec(uri) : null;
  const title = data?.name;
  if (!m || typeof title !== 'string' || !title.trim()) return null;

  const names = (list: Json): string[] =>
    Array.isArray(list?.items)
      ? list.items.map((a: Json) => a?.profile?.name).filter((n: unknown): n is string => typeof n === 'string' && n.length > 0)
      : [];
  let artists = names(data.artists);
  if (artists.length === 0) artists = names(data.albumOfTrack?.artists);

  const ms = data.trackDuration?.totalMilliseconds ?? data.duration?.totalMilliseconds;
  return {
    spotifyId: m[1],
    title,
    artists,
    durationMs: typeof ms === 'number' && ms > 0 ? Math.round(ms) : undefined,
  };
}

async function fetchPage(playlistId: string, token: string, offset: number, fetchFn: FetchFn): Promise<{ items: Json[]; total?: number }> {
  const body = JSON.stringify({
    operationName: 'fetchPlaylist',
    variables: { uri: `spotify:playlist:${playlistId}`, offset, limit: PAGE_SIZE, enableWatchFeedEntrypoint: true },
    extensions: { persistedQuery: { version: 1, sha256Hash: FETCH_PLAYLIST_HASH } },
  });
  const text = await withTimeout(async (signal) => {
    const res = await fetchFn(PATHFINDER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': UA,
      },
      body,
      signal,
    });
    if (!res.ok) throw new WebPlayerError(`Spotify respondió HTTP ${res.status}`);
    return res.text();
  });

  let json: Json;
  try { json = JSON.parse(text); } catch { throw new WebPlayerError('respuesta que no es JSON'); }
  if (Array.isArray(json?.errors) && json.errors.length > 0 && !json?.data?.playlistV2) {
    throw new WebPlayerError(`error de Spotify: ${String(json.errors[0]?.message ?? 'desconocido')}`);
  }
  const content: Json = json?.data?.playlistV2?.content;
  if (!content || !Array.isArray(content.items)) throw new WebPlayerError('formato de respuesta inesperado');
  return { items: content.items, total: typeof content.totalCount === 'number' ? content.totalCount : undefined };
}

/**
 * Descarga la playlist completa página a página. Lanza `WebPlayerError` si falla la primera
 * página; si falla una posterior devuelve lo obtenido con `complete: false`.
 */
export async function fetchFullPlaylist(
  playlistId: string, token: string, fetchFn: FetchFn, opts: WebPlayerOptions = {},
): Promise<WebPlayerResult> {
  const sleep = opts.sleep ?? defaultSleep;
  const delay = opts.pageDelayMs ?? 300;
  const tracks: EmbedTrack[] = [];
  let offset = 0;
  let total: number | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    let got: { items: Json[]; total?: number };
    try {
      got = await fetchPage(playlistId, token, offset, fetchFn);
    } catch (e) {
      const reason = e instanceof WebPlayerError ? e.message : `error de red (${(e as Error)?.message ?? 'desconocido'})`;
      if (page === 0) throw new WebPlayerError(reason);
      return { tracks, total, complete: false, reason };
    }
    if (page === 0) total = got.total;
    if (got.items.length === 0) break;
    for (const it of got.items) {
      const t = mapItem(it);
      if (t) tracks.push(t);
    }
    offset += got.items.length;
    if (total !== undefined ? offset >= total : got.items.length < PAGE_SIZE) break;
    if (delay > 0) await sleep(delay);
  }
  const complete = total === undefined || offset >= total;
  return complete ? { tracks, total, complete } : { tracks, total, complete, reason: 'la lista terminó antes del total declarado' };
}
