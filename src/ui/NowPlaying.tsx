import React, { RefObject, useState } from 'react';
import { Modal, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatClock } from '../core/player/format';
import { QueueItem, RepeatMode } from '../core/player/queue';
import { Cover } from './Cover';
import { Icon, IconBtn } from './kit';
import { Slider } from './Slider';
import { colors, radius } from './theme';
import { usePlayerProgress } from './usePlayerProgress';
import { PlayerHandle } from './YouTubePlayer';

interface Props {
  item: QueueItem;
  /** "Reproduciendo desde": nombre de la playlist o "Búsqueda". */
  source: string;
  playing: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  engine: RefObject<PlayerHandle | null>;
  onClose: () => void;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
}

/** Pantalla completa de reproducción (estilo app de streaming, con nuestra paleta). */
export function NowPlaying(p: Props) {
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={p.onClose}>
      <SafeAreaProvider><Inner {...p} /></SafeAreaProvider>
    </Modal>
  );
}

function Inner({ item, source, playing, shuffle, repeat, engine, onClose, onToggle, onNext, onPrev, onToggleShuffle, onCycleRepeat }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { position, duration, set } = usePlayerProgress(engine, playing, item.videoId);
  const [scrub, setScrub] = useState<number | null>(null);

  const cover = Math.min(width - 56, height * 0.4);
  const fraction = duration > 0 ? position / duration : 0;
  const shown = scrub !== null ? scrub * duration : position;

  return (
    <View style={[s.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <View style={s.top}>
        <IconBtn name="chevron-down" tone="light" onPress={onClose} iconSize={26} />
        <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
          <Text style={s.kicker}>REPRODUCIENDO DESDE</Text>
          <Text style={s.source} numberOfLines={1}>{source}</Text>
        </View>
        <View style={{ width: 46 }} />
      </View>

      <View style={s.coverWrap}>
        <View style={s.shadow}><Cover videoId={item.videoId} size={cover} radius={radius.xl} seed={item.title} /></View>
      </View>

      <View style={s.info}>
        <Text style={s.title} numberOfLines={2}>{item.title}</Text>
        <Text style={s.artist} numberOfLines={1}>{item.artists.join(', ')}</Text>
      </View>

      <View style={s.progress}>
        <Slider
          value={fraction} disabled={duration <= 0} onScrub={setScrub}
          onSeek={f => { engine.current?.seekTo(f * duration); set(f * duration); }}
        />
        <View style={s.times}>
          <Text style={s.time}>{formatClock(shown)}</Text>
          <Text style={s.time}>{duration > 0 ? formatClock(duration) : '--:--'}</Text>
        </View>
      </View>

      <View style={s.controls}>
        <IconBtn name="shuffle" tone={shuffle ? 'accent' : 'light'} size={46} iconSize={20} onPress={onToggleShuffle} />
        <Icon3 name="play-skip-back" onPress={onPrev} />
        <View style={s.main}>
          <IconBtn name={playing ? 'pause' : 'play'} tone="ghost" size={76} iconSize={34} onPress={onToggle} />
        </View>
        <Icon3 name="play-skip-forward" onPress={onNext} />
        <View>
          <IconBtn name="repeat" tone={repeat === 'off' ? 'light' : 'accent'} size={46} iconSize={20} onPress={onCycleRepeat} />
          {repeat === 'one' && <View style={s.one}><Text style={s.oneText}>1</Text></View>}
        </View>
      </View>
    </View>
  );
}

/** Icono grande de transporte (anterior/siguiente). */
function Icon3({ name, onPress }: { name: 'play-skip-back' | 'play-skip-forward'; onPress: () => void }) {
  return <IconBtn name={name} tone="light" size={56} iconSize={30} onPress={onPress} />;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.dark, paddingHorizontal: 24, justifyContent: 'space-between' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kicker: { color: colors.onDarkMuted, fontSize: 10, letterSpacing: 2, fontWeight: '800' },
  source: { color: colors.onDark, fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  coverWrap: { alignItems: 'center', justifyContent: 'center' },
  shadow: {
    borderRadius: radius.xl,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12,
  },
  info: { gap: 4 },
  title: { color: colors.onDark, fontSize: 26, lineHeight: 31, fontWeight: '800', letterSpacing: -0.7 },
  artist: { color: colors.onDarkMuted, fontSize: 17, fontWeight: '600' },
  progress: { gap: 2 },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { color: colors.onDarkMuted, fontSize: 12, fontWeight: '600' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  main: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.onDark, alignItems: 'center', justifyContent: 'center' },
  one: {
    position: 'absolute', top: 4, right: 4, width: 14, height: 14, borderRadius: 7,
    backgroundColor: colors.onDark, alignItems: 'center', justifyContent: 'center',
  },
  oneText: { color: colors.dark, fontSize: 9, fontWeight: '800' },
});
