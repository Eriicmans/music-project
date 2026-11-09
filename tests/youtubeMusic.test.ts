import { describe, it, expect } from 'vitest';
import {
  parseDuration,
  parseSearchResponse,
  searchYtMusic,
  buildQuery,
} from '../src/providers/youtubeMusic/search';

const pageRun = (text: string, pageType: string) => ({
  text,
  navigationEndpoint: {
    browseEndpoint: {
      browseEndpointContextSupportedConfigs: {
        browseEndpointContextMusicConfig: { pageType },
      },
    },
  },
});
const artistRun = (t: string) => pageRun(t, 'MUSIC_PAGE_TYPE_ARTIST');
const albumRun = (t: string) => pageRun(t, 'MUSIC_PAGE_TYPE_ALBUM');
const item = (videoId: string, title: string, runs: any[]) => ({
  musicResponsiveListItemRenderer: {
    playlistItemData: { videoId },
    flexColumns: [
      { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: title }] } } },
      { musicResponsiveListItemFlexColumnRenderer: { text: { runs } } },
    ],
  },
});

const fixture = {
  contents: {
    tabbedSearchResultsRenderer: {
      tabs: [
        {
          content: [
            {
              contents: [
                item('AAA', 'Blinding Lights', [
                  artistRun('The Weeknd'), { text: ' • ' }, albumRun('After Hours'), { text: ' • ' }, { text: '3:20' },
                ]),
                item('BBB', 'Blinding Lights (Live)', [
                  { text: 'Video' }, { text: ' • ' }, artistRun('Fan Channel'), { text: ' • ' }, { text: '4:01' },
                ]),
                item('AAA', 'Duplicado', [artistRun('X'), { text: ' • ' }, { text: '1:00' }]),
              ],
            },
          ],
        },
      ],
    },
  },
};

describe('youtube music search', () => {
  it('parsea duraciones', () => {
    expect(parseDuration('3:20')).toBe(200);
    expect(parseDuration('1:02:03')).toBe(3723);
    expect(parseDuration('Song')).toBeUndefined();
  });

  it('extrae canciones y vídeos, sin duplicar', () => {
    const r = parseSearchResponse(fixture);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({
      videoId: 'AAA', title: 'Blinding Lights', artists: ['The Weeknd'],
      album: 'After Hours', durationSec: 200, kind: 'song',
    });
    expect(r[1]).toMatchObject({ videoId: 'BBB', kind: 'video', durationSec: 241, artists: ['Fan Channel'] });
  });

  it('searchYtMusic usa fetch inyectado', async () => {
    const fetchFn = (async () => ({ ok: true, status: 200, json: async () => fixture })) as any;
    const r = await searchYtMusic(buildQuery('Blinding Lights', ['The Weeknd']), { fetchFn });
    expect(r[0].videoId).toBe('AAA');
  });

  it('error de red', async () => {
    const fetchFn = (async () => { throw new Error('x'); }) as any;
    await expect(searchYtMusic('q', { fetchFn })).rejects.toMatchObject({ code: 'network' });
  });
});
