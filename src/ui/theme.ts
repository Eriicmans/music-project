import { Platform, TextStyle } from 'react-native';

/**
 * Base: crema #F4EFE6 + marrón #523D2C. El marrón oscuro es el color de las
 * superficies de contraste (banner, tarjetas, reproductor, barra); el óxido
 * es el color de acción (botones, filtros activos).
 */
export const colors = {
  bg: '#F4EFE6',
  card: '#FBF9F5',
  chip: '#E8E0D2',
  line: '#E0D6C4',
  text: '#33261B',
  muted: '#7C6857',
  faint: '#A99A88',
  dark: '#523D2C',
  onDark: '#F4EFE6',
  onDarkMuted: 'rgba(244,239,230,0.66)',
  onDarkLine: 'rgba(244,239,230,0.16)',
  accent: '#9A5A3A',
  onAccent: '#FBF6EE',
  gold: '#B98B4E',
  terracotta: '#C0562F',
  danger: '#B2432C',
  dangerBg: '#F1DAD0',
};

export const radius = { sm: 12, md: 16, lg: 20, xl: 26 };

export const fonts = {
  mono: Platform.select({ ios: 'Courier', default: 'monospace' }) as string,
};

const h1: TextStyle = { color: colors.text, fontSize: 32, lineHeight: 37, fontWeight: '800', letterSpacing: -0.9 };
const h2: TextStyle = { color: colors.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 };
const body: TextStyle = { color: colors.muted, fontSize: 14, lineHeight: 20 };
const small: TextStyle = { color: colors.muted, fontSize: 12, lineHeight: 17 };

export const type = { h1, h2, body, small };