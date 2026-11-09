import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { QueueItem } from '../core/player/queue';
import { Cover } from './Cover';
import { Icon } from './kit';
import { colors, radius } from './theme';

/** Barra compacta de "ahora suena". Tocarla abre la pantalla completa. */
export function MiniPlayer({ item, playing, progress, onOpen, onToggle, onNext }: {
  item: QueueItem; playing: boolean; progress: number; onOpen: () => void; onToggle: () => void; onNext: () => void;
}) {
  return (
    <Pressable onPress={onOpen} style={s.wrap}>
      <View style={s.row}>
        <Cover videoId={item.videoId} size={46} radius={radius.sm} seed={item.title} />
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={s.title} numberOfLines={1}>{item.title}</Text>
          <Text style={s.artist} numberOfLines={1}>{item.artists.join(', ')}</Text>
        </View>
        <Pressable onPress={onToggle} hitSlop={8} style={s.main}>
          <Icon name={playing ? 'pause' : 'play'} size={20} color={colors.dark} />
        </Pressable>
        <Pressable onPress={onNext} hitSlop={10}><Icon name="play-skip-forward" size={22} color={colors.onDark} /></Pressable>
      </View>
      <View style={s.bar}><View style={[s.fill, { width: `${Math.min(100, Math.max(0, progress * 100))}%` }]} /></View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: colors.dark, borderRadius: radius.lg, marginHorizontal: 12, marginTop: 8, padding: 10, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { color: colors.onDark, fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  artist: { color: colors.onDarkMuted, fontSize: 12 },
  main: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.onDark, alignItems: 'center', justifyContent: 'center' },
  bar: { height: 3, borderRadius: 2, backgroundColor: colors.onDarkLine, overflow: 'hidden', marginHorizontal: 2 },
  fill: { height: 3, backgroundColor: colors.onDark },
});
