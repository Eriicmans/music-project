export type ImportErrorCode =
  | 'invalid_url' | 'not_playlist' | 'short_link' | 'network' | 'unavailable' | 'parse';

export class ImportError extends Error {
  constructor(public readonly code: ImportErrorCode, message: string) {
    super(message);
    this.name = 'ImportError';
  }
}
