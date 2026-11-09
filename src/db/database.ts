/**
 * Interfaz mínima de base de datos. Coincide con un subconjunto de
 * `SQLiteDatabase` de expo-sqlite, así el código se puede probar en Node.
 */
export type SqlParam = string | number | null;

export interface Db {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: SqlParam[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params?: SqlParam[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: SqlParam[]): Promise<T | null>;
}