import { describe, expect, it } from 'vitest';
import { buildQueue, shuffleQueue, stepIndex } from '../src/core/player/queue';

const e = (id: string, status: string | null, videoId: string | null) => ({
  track: { id, title: 'T' + id, artists: ['A'] }, status, videoId,
});

describe('cola de reproducción', () => {
  it('solo incluye canciones resueltas, en orden', () => {
    const q = buildQueue([e('1', 'auto', 'v1'), e('2', 'pending', null), e('3', 'none', null), e('4', 'manual', 'v4'), e('5', 'auto', null)]);
    expect(q.map(i => i.videoId)).toEqual(['v1', 'v4']);
    expect(q[1]).toMatchObject({ trackId: '4', title: 'T4', artists: ['A'] });
  });
  it('stepIndex respeta los extremos', () => {
    expect(stepIndex(0, 3, 1)).toBe(1);
    expect(stepIndex(2, 3, 1)).toBeNull();
    expect(stepIndex(0, 3, -1)).toBeNull();
    expect(stepIndex(2, 3, -1)).toBe(1);
  });
});

describe('aleatorio', () => {
  const items = ['1', '2', '3', '4', '5'].map(id => ({ trackId: id, videoId: 'v' + id, title: id, artists: ['A'] }));
  it('conserva todas las canciones y no modifica la original', () => {
    const out = shuffleQueue(items, undefined, () => 0.3);
    expect(out.map(i => i.trackId).sort()).toEqual(['1', '2', '3', '4', '5']);
    expect(items.map(i => i.trackId)).toEqual(['1', '2', '3', '4', '5']);
  });
  it('deja primera la canción indicada', () => {
    for (const r of [0, 0.5, 0.99]) expect(shuffleQueue(items, '4', () => r)[0].trackId).toBe('4');
  });
  it('realmente reordena', () => {
    expect(shuffleQueue(items, undefined, () => 0).map(i => i.trackId)).not.toEqual(['1', '2', '3', '4', '5']);
  });
});
