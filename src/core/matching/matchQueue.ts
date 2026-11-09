import { Track } from '../../models/Track';
import { ScoredCandidate, SearchFn, findCandidates } from './matchTrack';

export interface QueueDeps {
  search: SearchFn;
  /** Guarda el resultado (adaptar a repository.recordMatching). */
  record: (track: Track, scored: ScoredCandidate[]) => Promise<void>;
  /** Devuelve true si la canción ya tiene coincidencia auto/manual. */
  shouldSkip?: (track: Track) => Promise<boolean>;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

export interface QueueProgress {
  done: number;
  total: number;
  track: Track;
}

export interface QueueOptions {
  /** Pausa base entre búsquedas (más hasta un 50 % de variación). */
  delayMs?: number;
  /** Se detiene tras N errores seguidos (posible bloqueo). */
  maxConsecutiveErrors?: number;
  onProgress?: (p: QueueProgress) => void;
  signal?: { aborted: boolean };
}

export interface QueueSummary {
  processed: number;
  skipped: number;
  auto: number;
  review: number;
  none: number;
  errors: number;
  aborted: boolean;
  stoppedByErrors: boolean;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function runMatching(
  tracks: Track[],
  deps: QueueDeps,
  opts: QueueOptions = {},
): Promise<QueueSummary> {
  const sleep = deps.sleep ?? defaultSleep;
  const random = deps.random ?? Math.random;
  const delayMs = opts.delayMs ?? 800;
  const maxErrors = opts.maxConsecutiveErrors ?? 5;
  const s: QueueSummary = {
    processed: 0, skipped: 0, auto: 0, review: 0, none: 0,
    errors: 0, aborted: false, stoppedByErrors: false,
  };
  let consecutive = 0;
  let done = 0;

  for (const track of tracks) {
    if (opts.signal?.aborted) { s.aborted = true; break; }

    if (deps.shouldSkip && (await deps.shouldSkip(track))) {
      s.skipped++; done++;
      opts.onProgress?.({ done, total: tracks.length, track });
      continue;
    }

    try {
      const scored = await findCandidates(track, deps.search);
      await deps.record(track, scored);
      const best = scored.find((x) => x.result.decision !== 'reject');
      if (!best) s.none++;
      else if (best.result.decision === 'auto') s.auto++;
      else s.review++;
      s.processed++;
      consecutive = 0;
    } catch {
      s.errors++;
      consecutive++;
      if (consecutive >= maxErrors) { s.stoppedByErrors = true; break; }
    }

    done++;
    opts.onProgress?.({ done, total: tracks.length, track });
    if (done < tracks.length) await sleep(delayMs + Math.floor(random() * delayMs * 0.5));
  }
  return s;
}
