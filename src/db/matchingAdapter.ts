import { Track } from '../models/Track';
import { QueueDeps } from '../core/matching/matchQueue';
import { SearchFn } from '../core/matching/matchTrack';
import { Db } from './database';
import { getMatchStatus, recordMatching } from './repository';

/**
 * Conecta la cola de matching con la base de datos.
 * Se omiten las canciones ya resueltas (auto/manual) o pendientes de revisión;
 * las que quedaron en 'none' se reintentan.
 */
export function makeQueueDeps(db: Db, search: SearchFn): QueueDeps {
  return {
    search,
    record: async (track: Track, scored) => {
      await recordMatching(db, track.id, scored);
    },
    shouldSkip: async (track: Track) => {
      const m = await getMatchStatus(db, track.id);
      return m?.status === 'auto' || m?.status === 'manual' || m?.status === 'pending';
    },
  };
}
