import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { QueueItem } from '../core/player/queue';
import { Icon, IconBtn } from './kit';
import { colors, radius } from './theme';
import { YouTubePlayer } from './YouTubePlayer';

interface Props {
  item: QueueItem;
  playing: boolean;
  shuffle: boolean;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  onToggleShuffle: () => void;
  onEnded: () => void;
  onError: (reason: string) => void;
  onPlayingChange: (p: boolean) => void;
}

/** Reproductor: tarjeta marrón con el vídeo, el título y los controles. */
export function PlayerDock(p: Props) {
  return (
    <View style={s.dock}>
      <View style={s.video}>
        <YouTubePlayer
          videoId={p.item.videoId} playing={p.playing}
          onEnded={p.onEnded} onError={p.onError} onPlayingChange={p.onPlayingChange}
        />
      </View>
      <View style={s.info}>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={s.title} numberOfLines={1}>{p.item.title}</Text>
          <Text style={s.artist} numberOfLines={1}>{p.item.artists.join(', ')}</Text>
        </View>
        <Pressable onPress={p.onClose} hitSlop={12}><Icon name="close" size={20} color={colors.onDarkMuted} /></Pressable>
      </View>
      <View style={s.controls}>
        <IconBtn name="shuffle" size={42} iconSize={18} tone={p.shuffle ? 'accent' : 'ghost'} onPress={p.onToggleShuffle} />
        <View style={s.transport}>
          <Pressable onPress={p.onPrev} hitSlop={12}><Icon name="play-skip-back" size={24} color={colors.onDark} /></Pressable>
          <Pressable onPress={p.onToggle} style={s.main}>
            <Icon name={p.playing ? 'pause' : 'play'} size={24} color={colors.dark} />
          </Pressable>
          <Pressable onPress={p.onNext} hitSlop={12}><Icon name="play-skip-forward" size={24} color={colors.onDark} /></Pressable>
        </View>
        <View style={{ width: 42 }} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  dock: { backgroundColor: colors.dark, borderRadius: radius.xl, marginHorizontal: 12, marginTop: 8, padding: 12, gap: 10 },
  video: { borderRadius: radius.md, overflow: 'hidden' },
  info: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  title: { color: colors.onDark, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  artist: { color: colors.onDarkMuted, fontSize: 13 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  transport: { flexDirection: 'row', alignItems: 'center', gap: 28 },
  main: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.onDark, alignItems: 'center', justifyContent: 'center' },
});