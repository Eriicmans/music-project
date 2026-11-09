import { describe, it, expect } from 'vitest';
import { Track } from '../src/models/Track';
import { YtResult } from '../src/providers/youtubeMusic/search';
import { findCandidates } from '../src/core/matching/matchTrack';
import { runMatching } from '../src/core/matching/matchQueue';

const track = (id: string, title = 'Blinding Lights', artist = 'The Weeknd'): Track => ({
  id, title, artists: [artist], durationMs: 200000, version: 'studio', externalIds: {},
});

const good: YtResult = {
  videoId: 'AAA', title: 'Blinding Lights', artists: ['The Weeknd'],
  album: 'After Hours', durationSec: 200, kind: 'song',
};
const wrongArtist: YtResult = {
  videoId: 'ZZZ', title: 'Blinding Lights', artists: ['Otro Artista'],
  durationSec: 200, kind: 'song',
};

describe('findCandidates', () => {
  it('ordena el candidato correcto primero y lo marca auto', async () => {
    const r = await findCandidates(track('1'), async () => [wrongArtist, good]);
    expect(r[0].candidate.externalId).toBe('AAA');
    expect(r[0].result.decision).toBe('auto');
    expect(r[1].result.decision).toBe('reject');
  });

  it('reintenta sin filtro si el filtrado no devuelve nada', async () => {
    const calls: Array<boolean | undefined> = [];
    const r = await findCandidates(track('1'), async (_q, o) => {
      calls.push(o?.filter);
      return o?.filter === false ? [good] : [];
    });
    expect(calls).toEqual([undefined, false]);
    expect(r).toHaveLength(1);
  });
});

describe('runMatching', () => {
  const base = () => {
    const recorded: string[] = [];
    const sleeps: number[] = [];
    return {
      recorded, sleeps,
      deps: {
        search: async () => [good],
        record: async (t: Track) => { recorded.push(t.id); },
        sleep: async (ms: number) => { sleeps.push(ms); },
        random: () => 0,
      },
    };
  };

  it('procesa, omite ya resueltas y pausa entre búsquedas', async () => {
    const b = base();
    const s = await runMatching([track('1'), track('2'), track('3')], {
      ...b.deps, shouldSkip: async (t) => t.id === '2',
    }, { delayMs: 100 });
    expect(s).toMatchObject({ processed: 2, skipped: 1, auto: 2, errors: 0 });
    expect(b.recorded).toEqual(['1', '3']);
    expect(b.sleeps).toEqual([100, 100]);
  });

  it('se detiene tras errores seguidos', async () => {
    const b = base();
    const s = await runMatching([track('1'), track('2'), track('3')], {
      ...b.deps, search: async () => { throw new Error('bloqueado'); },
    }, { maxConsecutiveErrors: 2 });
    expect(s.stoppedByErrors).toBe(true);
    expect(s.errors).toBe(2);
  });

  it('respeta la cancelación', async () => {
    const b = base();
    const s = await runMatching([track('1')], b.deps, { signal: { aborted: true } });
    expect(s.aborted).toBe(true);
    expect(b.recorded).toEqual([]);
  });
});
