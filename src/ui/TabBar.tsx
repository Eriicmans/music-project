import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, IconName } from './kit';
import { colors, radius } from './theme';

export type Tab = 'library' | 'search' | 'review';

/** Barra flotante en forma de píldora marrón. */
export function TabBar({ tab, onChange, pending }: { tab: Tab; onChange: (t: Tab) => void; pending: number }) {
  const item = (t: Tab, icon: IconName, label: string, badge?: number) => (
    <Pressable onPress={() => onChange(t)} style={[s.item, tab === t && s.itemOn]}>
      <Icon name={icon} size={22} color={tab === t ? colors.onDark : colors.onDarkMuted} />
      {tab === t && <Text style={s.label}>{label}</Text>}
      {badge ? <View style={s.badge}><Text style={s.badgeText}>{badge > 99 ? '99+' : badge}</Text></View> : null}
    </Pressable>
  );
  return (
    <View style={s.wrap}>
      <View style={s.pill}>
        {item('library', tab === 'library' ? 'albums' : 'albums-outline', 'Biblioteca')}
        {item('search', tab === 'search' ? 'search' : 'search-outline', 'Buscar')}
        {item('review', tab === 'review' ? 'checkmark-done' : 'checkmark-done-outline', 'Revisar', pending)}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 8, backgroundColor: colors.bg },
  pill: { flexDirection: 'row', gap: 6, padding: 6, borderRadius: radius.xl, backgroundColor: colors.dark },
  item: { minWidth: 56, height: 46, paddingHorizontal: 14, borderRadius: radius.lg, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  itemOn: { backgroundColor: colors.accent },
  label: { color: colors.onDark, fontSize: 13, fontWeight: '800' },
  badge: {
    position: 'absolute', top: 0, right: 4, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: colors.terracotta, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
});
