/// <reference types="node" />
import { DatabaseSync } from 'node:sqlite';
import { Db, SqlParam } from '../../src/db/database';

/** Adaptador para probar el repositorio en Node con SQLite en memoria. */
export function createTestDb(): Db {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  const bind = (p?: SqlParam[]) => (p ?? []).map(v => (v === undefined ? null : v));
  return {
    async execAsync(sql) { db.exec(sql); },
    async runAsync(sql, params) { return db.prepare(sql).run(...bind(params)); },
    async getAllAsync<T>(sql: string, params?: SqlParam[]) { return db.prepare(sql).all(...bind(params)) as T[]; },
    async getFirstAsync<T>(sql: string, params?: SqlParam[]) { return (db.prepare(sql).get(...bind(params)) as T | undefined) ?? null; },
  };
}