export type TrackVersion =
  | 'studio'
  | 'live'
  | 'remix'
  | 'acoustic'
  | 'instrumental'
  | 'karaoke'
  | 'cover'
  | 'altered'
  | 'unknown';

export interface Track {
  /** Identidad interna estable, no dependiente de un proveedor. */
  id: string;
  title: string;
  artists: string[];
  album?: string;
  durationMs?: number;
  isrc?: string;
  version: TrackVersion;
  externalIds: {
    spotify?: string;
    youtubeVideo?: string;
    musicBrainzRecording?: string;
  };
}

export interface TrackCandidate {
  provider: 'youtube' | 'musicbrainz';
  externalId: string;
  title: string;
  artists: string[];
  album?: string;
  durationMs?: number;
  isrc?: string;
  version: TrackVersion;
}
