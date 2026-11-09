// Parte pura (sin react-native) del tema, para poder probarla en Node.

/* ---------- Identidad de color por playlist/canción (sin verdes) ---------- */
export type Tint = readonly [string, string];
export const tints: readonly Tint[] = [
  ['#EE6A3C', '#9C2F1B'], // brasa
  ['#F4B04A', '#C0652A'], // mostaza → cobre
  ['#9B4A7B', '#4A1D45'], // ciruela
  ['#4C6DA3', '#1F2F55'], // azul tinta
  ['#E58A92', '#8F3A4D'], // rosa
  ['#D9822B', '#6E3416'], // ámbar
  ['#7C5CB0', '#33224F'], // violeta
  ['#C4503F', '#5E1F2B'], // granate
];
const hashStr = (v: string) => { let h = 0; for (let i = 0; i < v.length; i++) h = (h * 31 + v.charCodeAt(i)) | 0; return Math.abs(h); };
/** Mismo texto → mismo par de colores. */
export const tintFor = (seed: string): Tint => tints[hashStr(seed) % tints.length];

/** Saludo según la hora. */
export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h >= 6 && h < 13) return 'Buenos días';
  if (h >= 13 && h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}
