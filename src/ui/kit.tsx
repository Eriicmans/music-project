import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from './theme';

/* ---------- Iconos (Ionicons) ---------- */
export type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 20, color = colors.text }: { name: IconName; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}

/* ---------- Botón cuadrado redondeado con icono ---------- */
type IconTone = 'soft' | 'accent' | 'dark' | 'ghost' | 'light';
const ICON_BG: Record<IconTone, string> = { soft: colors.chip, accent: colors.accent, dark: colors.dark, ghost: 'transparent', light: 'transparent' };
const ICON_FG: Record<IconTone, string> = { soft: colors.text, accent: colors.onAccent, dark: colors.onDark, ghost: colors.text, light: colors.onDark };

export function IconBtn({ name, onPress, tone = 'soft', size = 46, iconSize = 20, badge, disabled }: {
  name: IconName; onPress: () => void; tone?: IconTone; size?: number; iconSize?: number; badge?: number; disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress} disabled={disabled} hitSlop={6}
      style={({ pressed }) => ({
        width: size, height: size, borderRadius: radius.md, backgroundColor: ICON_BG[tone],
        alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : pressed ? 0.8 : 1,
      })}
    >
      <Icon name={name} size={iconSize} color={ICON_FG[tone]} />
      {badge ? (
        <View style={s.badge}><Text style={s.badgeText}>{badge > 99 ? '99+' : badge}</Text></View>
      ) : null}
    </Pressable>
  );
}

/* ---------- Botón con texto ---------- */
type BtnTone = 'accent' | 'dark' | 'soft' | 'light';
const BTN_BG: Record<BtnTone, string> = { accent: colors.accent, dark: colors.dark, soft: colors.chip, light: colors.onDark };
const BTN_FG: Record<BtnTone, string> = { accent: colors.onAccent, dark: colors.onDark, soft: colors.text, light: colors.dark };

export function Btn({ label, onPress, tone = 'accent', disabled, busy, flex, icon }: {
  label: string; onPress: () => void; tone?: BtnTone; disabled?: boolean; busy?: boolean; flex?: boolean; icon?: IconName;
}) {
  return (
    <Pressable
      onPress={onPress} disabled={disabled || busy}
      style={({ pressed }) => [
        s.btn, { backgroundColor: BTN_BG[tone] }, flex && { flex: 1 },
        (disabled || pressed) && { opacity: disabled ? 0.4 : 0.85 },
      ]}
    >
      {busy ? <ActivityIndicator color={BTN_FG[tone]} /> : (
        <View style={s.btnInner}>
          {icon && <Icon name={icon} size={17} color={BTN_FG[tone]} />}
          <Text style={[s.btnText, { color: BTN_FG[tone] }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

/* ---------- Chip de filtro ---------- */
export function Chip({ label, selected, onPress, tone = 'accent' }: {
  label: string; selected: boolean; onPress: () => void; tone?: 'accent' | 'dark';
}) {
  const on = tone === 'dark' ? colors.dark : colors.accent;
  return (
    <Pressable onPress={onPress} style={[s.chip, { backgroundColor: selected ? on : colors.chip }]}>
      <Text style={[s.chipText, { color: selected ? colors.onAccent : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

/* ---------- Disco (portada sin imagen) ---------- */
const TINTS = ['#6B3F22', '#8A5A33', '#9A5A3A', '#5A3A28', '#7C4A2D', '#946B45'];
const hash = (v: string) => { let h = 0; for (let i = 0; i < v.length; i++) h = (h * 31 + v.charCodeAt(i)) | 0; return Math.abs(h); };

export function Disc({ seed, size = 56 }: { seed: string; size?: number }) {
  const ring = (f: number, o: number) => ({
    position: 'absolute' as const, width: size * f, height: size * f, borderRadius: (size * f) / 2,
    borderWidth: 1, borderColor: `rgba(244,239,230,${o})`,
  });
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, backgroundColor: TINTS[hash(seed) % TINTS.length],
      alignItems: 'center', justifyContent: 'center',
    }}>
      <View style={ring(0.86, 0.16)} />
      <View style={ring(0.66, 0.12)} />
      <View style={ring(0.46, 0.1)} />
      <View style={{ width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: size * 0.07, height: size * 0.07, borderRadius: size * 0.035, backgroundColor: colors.dark }} />
      </View>
    </View>
  );
}

/* ---------- Estado de coincidencia ---------- */
export function StatusDot({ status }: { status: string | null }) {
  const filled = status === 'auto' ? colors.dark : status === 'manual' ? colors.gold : status === 'pending' ? colors.terracotta : null;
  return (
    <View style={{
      width: 9, height: 9, borderRadius: 5, backgroundColor: filled ?? 'transparent',
      borderWidth: filled ? 0 : 1.5, borderColor: colors.faint,
    }} />
  );
}

const s = StyleSheet.create({
  badge: {
    position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: colors.terracotta, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  btn: { borderRadius: radius.md, paddingVertical: 15, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { fontSize: 15, fontWeight: '700', letterSpacing: -0.1 },
  chip: { borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 16 },
  chipText: { fontSize: 13, fontWeight: '700' },
});
