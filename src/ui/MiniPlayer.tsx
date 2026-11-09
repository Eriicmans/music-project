import React, { ReactNode, useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { QueueItem } from '../core/player/queue';
import { Cover } from './Cover';
import { Icon } from './kit';
import { colors, radius } from './theme';

export const MINI_BUTTON = 38;

/** Aro que late alrededor del botón de play mientras se espera el primer toque. */
function Pulse() {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [t]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[s.pulse, { opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }), transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }] }]}
    />
  );
}

/**
 * Barra compacta de "ahora suena". Tocarla abre la pantalla completa.
 * `engine` es el reproductor (invisible): vive dentro del botón de play para poder
 * recibir el primer toque que exige iOS. Mientras `awaitingTap`, el botón late y avisa.
 */
export function MiniPlayer({ item, playing, progress, awaitingTap, engine, onOpen, onToggle, onNext }: {
  item: QueueItem; playing: boolean; progress: number; awaitingTap: boolean; engine: ReactNode;
  onOpen: () => void; onToggle: () => void; onNext: () => void;
}) {
  return (
    <Pressable onPress={onOpen} style={s.wrap}>
      <View style={s.row}>
        <Cover videoId={item.videoId} size={46} radius={radius.sm} seed={item.title} />
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={s.title} numberOfLines={1}>{item.title}</Text>
          {awaitingTap
            ? <Text style={s.hint} numberOfLines={1}>Toca ▶ para empezar</Text>
            : <Text style={s.artist} numberOfLines={1}>{item.artists.join(', ')}</Text>}
        </View>
        <View style={s.host}>
          {awaitingTap && <Pulse />}
          <Pressable onPress={onToggle} hitSlop={8} style={s.main}>
            <Icon name={playing && !awaitingTap ? 'pause' : 'play'} size={20} color={colors.dark} />
          </Pressable>
          {engine}
        </View>
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
  hint: { color: colors.gold, fontSize: 12, fontWeight: '700' },
  host: { width: MINI_BUTTON, height: MINI_BUTTON },
  main: { width: MINI_BUTTON, height: MINI_BUTTON, borderRadius: MINI_BUTTON / 2, backgroundColor: colors.onDark, alignItems: 'center', justifyContent: 'center' },
  pulse: { position: 'absolute', left: 0, top: 0, width: MINI_BUTTON, height: MINI_BUTTON, borderRadius: MINI_BUTTON / 2, backgroundColor: colors.onDark },
  bar: { height: 3, borderRadius: 2, backgroundColor: colors.onDarkLine, overflow: 'hidden', marginHorizontal: 2 },
  fill: { height: 3, backgroundColor: colors.onDark },
});