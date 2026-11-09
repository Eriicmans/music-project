/** 83.4 → "1:23". Valores no válidos o negativos → "0:00". */
export function formatClock(sec: number): string {
  const s = Number.isFinite(sec) && sec > 0 ? Math.floor(sec) : 0;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Miniatura de YouTube (4:3). En canciones trae la portada cuadrada centrada: basta recortar al centro. */
export const thumbnailUrl = (videoId: string): string => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

export const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
