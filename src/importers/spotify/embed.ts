import { ImportError } from '../errors';

export interface EmbedTrack {
  spotifyId: string;
  title: string;
  artists: string[];
  durationMs?: number;
}
export interface EmbedPlaylist {
  name: string;
  tracks: EmbedTrack[];
  /** true si la lista alcanzó el tope del embed (≈100): puede haber más canciones. */
  partial: boolean;
  /** Pistas omitidas (archivos locales, episodios, entradas sin id). */
  skipped: number;
}

export const EMBED_TRACK_CAP = 100;

export function extractNextData(html: string): unknown {
  const m = /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new ImportError('parse', 'La página de Spotify no tiene el formato esperado (¿ha cambiado?).');
  try { return JSON.parse(m[1]); }
  catch { throw new ImportError('parse', 'No se pudo leer los datos de la página de Spotify.'); }
}

/** Busca una clave en un árbol JSON (tolera cambios de estructura). */
function findKey(node: unknown, key: string, depth = 0): unknown {
  if (!node || typeof node !== 'object' || depth > 12) return undefined;
  const obj = node as Record<string, unknown>;
  if (key in obj) return obj[key];
  for (const value of Object.values(obj)) {
    const found = findKey(value, key, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

export function artistsFromSubtitle(subtitle: unknown): string[] {
  if (typeof subtitle !== 'string') return [];
  return subtitle.replace(/\u00a0/g, ' ').split(',').map(s => s.trim()).filter(Boolean);
}

export function parseEmbedHtml(html: string): EmbedPlaylist {
  const data = extractNextData(html);
  const entity = findKey(data, 'entity') as Record<string, unknown> | null | undefined;
  const list = (entity && (entity.trackList as unknown)) ?? findKey(data, 'trackList');
  if (!Array.isArray(list)) {
    throw new ImportError('unavailable', 'No se pudo leer la playlist: puede ser privada, estar borrada o no estar disponible.');
  }

  const tracks: EmbedTrack[] = [];
  let skipped = 0;
  for (const raw of list as Array<Record<string, unknown>>) {
    const uri = typeof raw.uri === 'string' ? raw.uri : '';
    const m = /^spotify:track:([A-Za-z0-9]{22})$/.exec(uri);
    const title = typeof raw.title === 'string' ? raw.title : typeof raw.name === 'string' ? raw.name : '';
    if (!m || !title) { skipped++; continue; }
    tracks.push({
      spotifyId: m[1],
      title,
      artists: artistsFromSubtitle(raw.subtitle),
      durationMs: typeof raw.duration === 'number' && raw.duration > 0 ? Math.round(raw.duration) : undefined,
    });
  }

  const nameRaw = entity?.name ?? entity?.title;
  return {
    name: typeof nameRaw === 'string' && nameRaw ? nameRaw : 'Playlist de Spotify',
    tracks,
    partial: list.length >= EMBED_TRACK_CAP,
    skipped,
  };
}

export type FetchFn = (url: string, init?: { headers?: Record<string, string> }) =>
  Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

export async function fetchEmbedPlaylist(playlistId: string, fetchFn: FetchFn): Promise<EmbedPlaylist> {
  let res;
  try {
    res = await fetchFn(`https://open.spotify.com/embed/playlist/${playlistId}`, { headers: HEADERS });
  } catch {
    throw new ImportError('network', 'No hay conexión con Spotify. Revisa tu internet e inténtalo de nuevo.');
  }
  if (res.status === 404) throw new ImportError('unavailable', 'Esa playlist no existe o es privada.');
  if (!res.ok) throw new ImportError('network', `Spotify respondió con el error ${res.status}.`);
  return parseEmbedHtml(await res.text());
}
