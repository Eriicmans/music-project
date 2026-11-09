import { describe, expect, it } from 'vitest';
import { normalize, scoreCandidate } from '../src/core/matching/scoreCandidate';
import { Track, TrackCandidate } from '../src/models/Track';

const track: Track = {
  id: 't1', title: 'Señorita', artists: ['Shawn Mendes', 'Camila Cabello'],
  album: 'Shawn Mendes', durationMs: 190000, isrc: 'USUM71900764',
  version: 'studio', externalIds: {},
};
const cand = (o: Partial<TrackCandidate> = {}): TrackCandidate => ({
  provider: 'youtube', externalId: 'v1', title: 'Señorita',
  artists: ['Shawn Mendes'], durationMs: 190500, version: 'studio', ...o,
});

describe('normalize', () => {
  it('quita tildes, mayúsculas y signos', () => {
    expect(normalize('  Señor   CAFÉ! ')).toBe('senor cafe');
    expect(normalize('Rock & Roll')).toBe('rock and roll');
  });
});

describe('scoreCandidate', () => {
  it('1. mismo título, artista distinto: nunca auto', () => {
    const r = scoreCandidate(track, cand({ artists: ['Otro Artista'] }));
    expect(r.decision).not.toBe('auto');
    expect(r.conflicts).toContain('Artista no coincidente');
  });
  it('3. ISRC igual + metadatos coherentes: auto', () => {
    const r = scoreCandidate(track, cand({ isrc: 'USUM71900764' }));
    expect(r.decision).toBe('auto');
  });
  it('4. original vs live: nunca auto', () => {
    const r = scoreCandidate(track, cand({ version: 'live', isrc: 'USUM71900764' }));
    expect(r.decision).not.toBe('auto');
  });
  it('2. duración muy distinta: no auto', () => {
    const r = scoreCandidate(track, cand({ durationMs: 260000, isrc: 'USUM71900764' }));
    expect(r.decision).not.toBe('auto');
  });
  it('7. acentos/mayúsculas equivalentes en título', () => {
    const r = scoreCandidate(track, cand({ title: 'SEÑORITA' }));
    expect(r.reasons).toContain('Título coincidente');
  });
});

describe('paso 2: versiones, feat. y títulos flexibles', () => {
  const t: Track = { ...track, isrc: undefined, title: 'Señorita' };
  it('"Artista - Título (Official Video)" se autoacepta si todo cuadra', () => {
    const r = scoreCandidate(t, cand({ title: 'Shawn Mendes - Señorita (Official Video)', isrc: undefined }));
    expect(r.decision).toBe('auto');
  });
  it('"(Live)" en el título de YouTube nunca es auto', () => {
    const r = scoreCandidate(t, cand({ title: 'Señorita (Live at Wembley)', isrc: undefined }));
    expect(r.conflicts).toContain('Versión diferente');
    expect(r.decision).toBe('reject');
  });
  it('feat. en el título no rompe el match de título', () => {
    const tr: Track = { ...t, title: 'Señorita (feat. Camila Cabello)' };
    const r = scoreCandidate(tr, cand({ title: 'Señorita', isrc: undefined }));
    expect(r.reasons).toContain('Título coincidente');
  });
  it('sped up / slowed se detecta como versión alterada', () => {
    const r = scoreCandidate(t, cand({ title: 'Señorita (sped up)', isrc: undefined }));
    expect(r.conflicts).toContain('Versión diferente');
  });
  it('sin duración no hay auto (solo revisión)', () => {
    const r = scoreCandidate(t, cand({ durationMs: undefined, isrc: undefined }));
    expect(r.decision).toBe('review');
  });
  it('re-grabación "(Taylor\'s Version)" no coincide con el original', () => {
    const tr: Track = { ...t, title: 'Love Story', artists: ['Taylor Swift'] };
    const r = scoreCandidate(tr, cand({ title: "Love Story (Taylor's Version)", artists: ['Taylor Swift'], isrc: undefined }));
    expect(r.decision).not.toBe('auto');
  });
});
