import { TrackCandidate } from '../../models/Track';
import { parseTitle } from '../../core/matching/parseTitle';
import { YtResult } from './search';

/** Convierte un resultado de YouTube Music en candidato para scoreCandidate. */
export function toCandidate(r: YtResult): TrackCandidate {
  const { version } = parseTitle(r.title, r.artists);
  return {
    provider: 'youtube',
    externalId: r.videoId,
    title: r.title,
    artists: r.artists,
    album: r.album,
    durationMs: r.durationSec !== undefined ? r.durationSec * 1000 : undefined,
    version,
  };
}
