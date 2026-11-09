import { TrackVersion } from '../../models/Track';

export interface ParsedTitle {
  /** Título limpio, sin marcadores de versión, feat. ni ruido de YouTube. */
  baseTitle: string;
  /** 'studio' si no hay ningún marcador de versión. */
  version: TrackVersion;
  featured: string[];
}

const VERSION_RULES: Array<[TrackVersion, RegExp]> = [
  ['karaoke', /karaoke|backing track/i],
  ['instrumental', /instrumental/i],
  ['live', /\blive\b|en vivo|en directo|unplugged/i],
  ['acoustic', /acoustic|ac[uú]stic[oa]/i],
  ['remix', /remix|\brmx\b|bootleg|mashup|\b(extended|club|dub|vip) mix\b/i],
  ['cover', /\bcover\b/i],
  ['altered', /sped up|speed up|slowed|nightcore|8d audio|reverb|bass boosted/i],
];

const NOISE_WORDS = new Set([
  'official', 'video', 'audio', 'lyrics', 'lyric', 'visualizer', 'visualiser',
  'hd', '4k', 'hq', 'remastered', 'remaster', 'radio', 'edit', 'single', 'version',
  'album', 'explicit', 'clean', 'mono', 'stereo', 'music', 'mv', 'original',
  'deluxe', 'bonus', 'track', 'topic', 'with', 'and',
]);

const FEAT_GROUP = /^(?:feat\.?|ft\.?|featuring|with)\s+(.+)$/i;
const FEAT_INLINE = /\s+(?:feat\.?|ft\.?|featuring)\s+(.+)$/i;
const ARTIST_SPLIT = /\s*(?:,|&|;|\bx\b|\band\b|\by\b|\bfeat\.?|\bft\.?|\bwith\b)\s*/i;

const plain = (v: string): string =>
  v.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
    .replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');

export function splitArtists(raw: string): string[] {
  return raw.split(ARTIST_SPLIT).map(s => s.trim()).filter(Boolean);
}

function isNoise(text: string): boolean {
  const tokens = plain(text).split(' ').filter(Boolean);
  return tokens.length > 0 && tokens.every(t => NOISE_WORDS.has(t) || /^\d{4}$/.test(t));
}

/**
 * Limpia un título de Spotify o YouTube. `knownArtists` permite quitar el
 * prefijo "Artista - " típico de YouTube.
 */
export function parseTitle(raw: string, knownArtists: string[] = []): ParsedTitle {
  let version: TrackVersion = 'studio';
  const featured: string[] = [];
  const kept: string[] = [];

  const classify = (chunk: string): string | null => {
    const text = chunk.trim();
    if (!text) return null;
    for (const [v, re] of VERSION_RULES) {
      if (re.test(text)) { if (version === 'studio') version = v; return null; }
    }
    const feat = FEAT_GROUP.exec(text);
    if (feat) { featured.push(...splitArtists(feat[1])); return null; }
    if (isNoise(text)) return null;
    return text;
  };

  // 1) Grupos entre paréntesis o corchetes.
  let work = raw.replace(/[(\[]([^)\]]*)[)\]]/g, (_m, inner: string) => {
    const keep = classify(inner);
    return keep ? ` ${keep} ` : ' ';
  });

  // 2) Segmentos separados por " - ".
  let segments = work.split(/\s[-–—]\s/).map(s => s.trim()).filter(Boolean);
  if (segments.length >= 2) {
    const known = new Set(knownArtists.flatMap(a => [plain(a), ...splitArtists(a).map(plain)]));
    if (known.has(plain(segments[0]))) segments = segments.slice(1);
  }
  let base = segments[0] ?? '';
  for (const seg of segments.slice(1)) {
    const keep = classify(seg);
    if (keep) kept.push(keep);
  }

  // 3) "Título feat. X" sin paréntesis.
  const inline = FEAT_INLINE.exec(base);
  if (inline) { featured.push(...splitArtists(inline[1])); base = base.slice(0, inline.index); }

  const baseTitle = [base, ...kept].join(' ').replace(/\s+/g, ' ').trim();
  return { baseTitle, version, featured };
}

function bigrams(s: string): string[] {
  const t = s.replace(/ /g, '');
  if (t.length < 2) return [t];
  const out: string[] = [];
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
  return out;
}

/** Similitud 0..1 (coeficiente de Dice sobre bigramas). Tolera erratas leves. */
export function titleSimilarity(a: string, b: string): number {
  const x = plain(a), y = plain(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const bx = bigrams(x), by = bigrams(y);
  const counts = new Map<string, number>();
  for (const g of bx) counts.set(g, (counts.get(g) ?? 0) + 1);
  let hits = 0;
  for (const g of by) {
    const c = counts.get(g) ?? 0;
    if (c > 0) { hits++; counts.set(g, c - 1); }
  }
  return (2 * hits) / (bx.length + by.length);
}
