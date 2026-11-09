import { Db } from './database';

/** Cada elemento es una versión del esquema; se aplican en orden. */
const MIGRATIONS: string[][] = [
  [
    `CREATE TABLE tracks (
      id TEXT PRIMARY KEY,
      spotify_id TEXT UNIQUE,
      title TEXT NOT NULL,
      artists TEXT NOT NULL,
      album TEXT,
      duration_ms INTEGER,
      isrc TEXT,
      version TEXT NOT NULL,
      musicbrainz_id TEXT,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE playlists (
      id TEXT PRIMARY KEY,
      spotify_id TEXT UNIQUE,
      name TEXT NOT NULL,
      source_url TEXT,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE playlist_tracks (
      playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      PRIMARY KEY (playlist_id, position)
    )`,
    `CREATE TABLE candidates (
      track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      external_id TEXT NOT NULL,
      title TEXT NOT NULL,
      artists TEXT NOT NULL,
      duration_ms INTEGER,
      version TEXT NOT NULL,
      score REAL NOT NULL,
      decision TEXT NOT NULL,
      reasons TEXT NOT NULL,
      conflicts TEXT NOT NULL,
      warnings TEXT NOT NULL,
      PRIMARY KEY (track_id, provider, external_id)
    )`,
    `CREATE TABLE matches (
      track_id TEXT PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
      video_id TEXT,
      status TEXT NOT NULL CHECK (status IN ('auto','manual','pending','none')),
      score REAL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE INDEX idx_matches_status ON matches(status)`,
    `CREATE INDEX idx_playlist_tracks_track ON playlist_tracks(track_id)`,
  ],
];

export const SCHEMA_VERSION = MIGRATIONS.length;

export async function migrate(db: Db): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  for (; version < MIGRATIONS.length; version++) {
    await db.execAsync('BEGIN');
    try {
      for (const statement of MIGRATIONS[version]) await db.execAsync(statement);
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
      await db.execAsync('COMMIT');
    } catch (error) {
      await db.execAsync('ROLLBACK');
      throw error;
    }
  }
  return version;
}