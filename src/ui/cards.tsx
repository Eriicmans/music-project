import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PlaylistInfo } from '../db/repository';
import { Disc, Icon, StatusDot } from './kit';
import { colors, radius } from './theme';

/** Tarjeta de playlist: zona clara con el disco y franja marrón con el nombre. */
export function PlaylistCard({ info, width, onPress, onDelete }: {
  info: PlaylistInfo; width: number; onPress: () => void; onDelete: () => void;
}) {
  const meta = info.pending > 0 ? `${info.pending} dudosas` : `${info.total} canciones`;
  return (
    <Pressable onPress={onPress} style={[s.card, { width }]}>
      <View style={[s.top, { height: width * 0.78 }]}>
        <Disc seed={info.name} size={width * 0.54} />
      </View>
      <View style={s.bottom}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.meta} numberOfLines={1}>{meta}</Text>
          <Text style={s.name} numberOfLines={1}>{info.name}</Text>
        </View>
        <Pressable onPress={onDelete} hitSlop={8} style={s.round}>
          <Icon name="trash-outline" size={15} color={colors.dark} />
        </Pressable>
      </View>
    </Pressable>
  );
}

/** Fila de canción con el vídeo elegido debajo. Pulsación larga = acciones (p. ej. quitar). */
export function TrackRow({ index, title, artists, videoCaption, status, isNow, playable, onPress, onSearch, onLongPress }: {
  index: number; title: string; artists: string; videoCaption?: string; status: string | null;
  isNow: boolean; playable: boolean; onPress: () => void; onSearch?: () => void; onLongPress?: () => void;
}) {
  return (
    <Pressable onPress={playable ? onPress : undefined} onLongPress={onLongPress} delayLongPress={450} style={s.row}>
      <View style={[s.num, isNow && { backgroundColor: colors.accent }]}>
        {isNow
          ? <Icon name="musical-notes" size={16} color={colors.onAccent} />
          : <Text style={s.numText}>{String(index).padStart(2, '0')}</Text>}
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[s.title, isNow && { color: colors.accent }]} numberOfLines={1}>{title}</Text>
        <Text style={s.artist} numberOfLines={1}>{artists}</Text>
        {videoCaption ? <Text style={s.caption} numberOfLines={1}>{videoCaption}</Text> : null}
      </View>
      {onSearch && (
        <Pressable onPress={onSearch} hitSlop={10} style={s.searchBtn}>
          <Icon name="search" size={15} color={colors.muted} />
        </Pressable>
      )}
      <StatusDot status={status} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.chip },
  top: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.chip },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.dark, padding: 12, borderRadius: radius.lg },
  meta: { color: colors.onDarkMuted, fontSize: 11 },
  name: { color: colors.onDark, fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  round: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.onDark, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, paddingRight: 16,
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
  },
  num: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
  searchBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
  numText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  title: { color: colors.text, fontSize: 15, fontWeight: '700', letterSpacing: -0.1 },
  artist: { color: colors.muted, fontSize: 13 },
  caption: { color: colors.faint, fontSize: 11, fontStyle: 'italic' },
});
