import * as SQLite from 'expo-sqlite';
import { Db } from './database';
import { migrate } from './migrations';

let opening: Promise<Db> | null = null;

/** Abre (una sola vez) la base de datos local y aplica las migraciones. */
export function openDb(): Promise<Db> {
  if (!opening) {
    opening = (async () => {
      const db = (await SQLite.openDatabaseAsync('music.db')) as unknown as Db;
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      await migrate(db);
      return db;
    })();
    opening.catch(() => { opening = null; });
  }
  return opening;
}