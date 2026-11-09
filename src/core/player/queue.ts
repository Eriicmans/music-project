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
