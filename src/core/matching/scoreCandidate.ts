import { Track, TrackCandidate, TrackVersion } from '../../models/Track';
import { parseTitle, splitArtists, titleSimilarity } from './parseTitle';

export type MatchDecision = 'auto' | 'review' | 'reject';

export interface MatchResult {
  score: number;
  decision: MatchDecision;
  reasons: string[];
  conflicts: string[];
  /** Señales débiles: impiden la aceptación automática pero no la revisión. */
  warnings: string[];
}

export const normalize = (value: string): string =>
  value.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const sameText = (a?: string, b?: string): boolean =>
  Boolean(a && b && normalize(a) === normalize(b));

/** Nombres completos y sus partes ("A & B" -> "a and b", "a", "b"). */
function artistSet(artists: string[], featured: string[]): Set<string> {
  const out = new Set<string>();
  for (const name of [...artists, ...featured]) {
    out.add(normalize(name));
    splitArtists(name).forEach(p => out.add(normalize(p)));
  }
  out.delete('');
  return out;
}

function effectiveVersion(parsed: TrackVersion, declared: TrackVersion): TrackVersion {
  if (parsed !== 'studio') return parsed;
  return declared === 'unknown' ? 'studio' : declared;
}

export function scoreCandidate(track: Track, candidate: TrackCandidate): MatchResult {
  let score = 0;
  const reasons: string[] = [];
  const conflicts: string[] = [];
  const warnings: string[] = [];

  const known = [...track.artists, ...candidate.artists];
  const tp = parseTitle(track.title, known);
  const cp = parseTitle(candidate.title, known);

  // Identidad fuerte: ISRC.
  let isrcMatch = false;
  if (track.isrc && candidate.isrc) {
    if (normalize(track.isrc) === normalize(candidate.isrc)) {
      isrcMatch = true; score += 40; reasons.push('ISRC exacto');
    } else conflicts.push('ISRC diferente');
  }

  // Artistas (con invitados extraídos del título).
  const trackArtists = artistSet(track.artists, tp.featured);
  const candArtists = artistSet(candidate.artists, cp.featured);
  const primary = track.artists[0] ? normalize(track.artists[0]) : '';
  const primaryMatch = Boolean(primary && candArtists.has(primary));
  const anyMatch = [...trackArtists].some(a => candArtists.has(a));
  if (primaryMatch) {
    score += 25; reasons.push('Artista principal coincidente');
  } else if (anyMatch) {
    score += 12; warnings.push('Solo coincide un artista secundario');
  } else if (track.artists.length && candidate.artists.length) {
    conflicts.push('Artista no coincidente');
  }

  // Título (ya sin feat., versión ni ruido).
  const exactTitle = sameText(tp.baseTitle, cp.baseTitle);
  if (exactTitle) {
    score += 15; reasons.push('Título coincidente');
  } else if (titleSimilarity(tp.baseTitle, cp.baseTitle) >= 0.85) {
    score += 10; warnings.push('Título muy similar, no idéntico');
  } else conflicts.push('Título diferente');

  // Duración.
  let durationClose = false;
  if (track.durationMs && candidate.durationMs) {
    const delta = Math.abs(track.durationMs - candidate.durationMs);
    if (delta <= 2000) { durationClose = true; score += 10; reasons.push('Duración muy próxima'); }
    else if (delta <= 5000) { score += 5; reasons.push('Duración razonablemente próxima'); }
    else conflicts.push('Duración muy diferente');
  }

  // Versión: la ausencia de marcador se interpreta como estudio en ambos lados.
  const tv = effectiveVersion(tp.version, track.version);
  const cv = effectiveVersion(cp.version, candidate.version);
  const versionsAgree = tv === cv;
  if (versionsAgree) { score += 10; reasons.push('Versión coincidente'); }
  else conflicts.push('Versión diferente');

  if (sameText(track.album, candidate.album)) reasons.push('Álbum coincidente');

  // Decisión. Sin ISRC (lo normal en YouTube) solo se autoacepta con metadatos
  // estrictos: artista principal + título exacto + duración ±2 s + misma versión.
  const clean = conflicts.length === 0 && warnings.length === 0 && primaryMatch;
  const strongMetadata = exactTitle && durationClose && versionsAgree;
  let decision: MatchDecision = 'reject';
  if (clean && (isrcMatch ? score >= 90 : strongMetadata)) {
    decision = 'auto';
  } else if (
    !conflicts.includes('Artista no coincidente') &&
    !conflicts.includes('Versión diferente') &&
    !conflicts.includes('ISRC diferente') &&
    score >= 40
  ) {
    decision = 'review';
  }

  return { score, decision, reasons, conflicts, warnings };
}
