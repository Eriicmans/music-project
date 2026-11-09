export interface QueueItem {
  trackId: string;
  videoId: string;
  title: string;
  artists: string[];
}

interface EntryLike {
  track: { id: string; title: string; artists: string[] };
  status: string | null;
  videoId: string | null;
}

/** Cola de reproducción: solo canciones con vídeo resuelto (auto o manual), en el orden de la playlist. */
export function buildQueue(entries: EntryLike[]): QueueItem[] {
  return entries
    .filter(e => (e.status === 'auto' || e.status === 'manual') && e.videoId)
    .map(e => ({ trackId: e.track.id, videoId: e.videoId as string, title: e.track.title, artists: e.track.artists }));
}

/** Índice siguiente/anterior, o null si se sale de la cola. */
export function stepIndex(index: number, length: number, dir: 1 | -1): number | null {
  const n = index + dir;
  return n >= 0 && n < length ? n : null;
}

export type RepeatMode = 'off' | 'all' | 'one';

export const nextRepeat = (m: RepeatMode): RepeatMode => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off');

/**
 * Índice siguiente/anterior según el modo de repetir. Con 'all' la cola da la vuelta;
 * con 'off' y 'one' (al pasar a mano) se sale por los extremos (null).
 */
export function nextIndex(index: number, length: number, dir: 1 | -1, repeat: RepeatMode): number | null {
  const n = stepIndex(index, length, dir);
  if (n !== null || repeat !== 'all' || length === 0) return n;
  return dir === 1 ? 0 : length - 1;
}

/**
 * Mezcla la cola (Fisher-Yates). Si se indica `firstTrackId`, esa canción queda
 * la primera y el resto se mezcla. `random` es inyectable para los tests.
 */
export function shuffleQueue(items: QueueItem[], firstTrackId?: string, random: () => number = Math.random): QueueItem[] {
  const first = firstTrackId ? items.find(i => i.trackId === firstTrackId) : undefined;
  const rest = items.filter(i => i !== first);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return first ? [first, ...rest] : rest;
}
