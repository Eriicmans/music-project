import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PlaylistInfo } from '../db/repository';
import { Cover } from './Cover';
import { Icon, StatusDot } from './kit';
import { FadeIn, PressScale } from './motion';
import { PlaylistCover } from './PlaylistCover';
import { colors, radius, tintFor } from './theme';

/** Tarjeta cuadrada: portada a sangre, nombre sobre un degradado oscuro, avance de coincidencias y aviso de dudosas. */
export function PlaylistCard({ info, videoIds, width, index = 0, onPress, onDelete }: {
  info: PlaylistInfo; videoIds: string[]; width: number; index?: number; onPress: () => void; onDelete: () => void;
}) {
  const done = info.total > 0 ? info.resolved / info.total : 0;
  return (
    <FadeIn delay={Math.min(index, 8) * 45}>
      <PressScale onPress={onPress} style={[s.card, { width, height: width }]}>
        <PlaylistCover name={info.name} videoIds={videoIds} size={width} radius={0} />
        <LinearGradient colors={['rgba(20,10,4,0)', 'rgba(20,10,4,0.82)']} style={s.scrim}>
          <Text style={s.name} numberOfLines={2}>{info.name}</Text>
          <Text style={s.meta} numberOfLines={1}>{info.total} canciones</Text>
          <View style={s.track}><View style={[s.trackFill, { width: `${Math.round(done * 100)}%` }]} /></View>
        </LinearGradient>
        {info.pending > 0 && (
          <View style={s.badge}><Text style={s.badgeText}>{info.pending} dudosas</Text></View>
        )}
        <Pressable onPress={onDelete} hitSlop={8} style={s.del}>
          <Icon name="trash-outline" size={15} color="#FFFFFF" />
        </Pressable>
      </PressScale>
    </FadeIn>
  );
}

/** Tarjeta ancha de la última playlist: degradado de su color, portada con sombra y flecha. */
export function PlaylistHero({ info, videoIds, onPress }: { info: PlaylistInfo; videoIds: string[]; onPress: () => void }) {
  const [a, b] = tintFor(info.name);
  return (
    <FadeIn>
      <PressScale onPress={onPress} scale={0.98} style={s.heroWrap}>
        <LinearGradient colors={[a, b]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
          <View style={s.heroBlob} />
          <View style={s.heroCover}><PlaylistCover name={info.name} videoIds={videoIds} size={110} radius={radius.md} /></View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={s.heroKicker}>ÚLTIMA AÑADIDA</Text>
            <Text style={s.heroName} numberOfLines={2}>{info.name}</Text>
            <Text style={s.heroMeta} numberOfLines={1}>
              {info.total} canciones · {info.resolved} listas{info.pending > 0 ? ` · ${info.pending} dudosas` : ''}
            </Text>
          </View>
          <View style={s.heroGo}><Icon name="arrow-forward" size={18} color={colors.dark} /></View>
        </LinearGradient>
      </PressScale>
    </FadeIn>
  );
}

/** Fila de canción: miniatura del vídeo elegido (o número), título, artistas y vídeo elegido debajo. Pulsación larga = acciones. */
export function TrackRow({ index, title, artists, videoId, videoCaption, status, isNow, playable, onPress, onSearch, onLongPress }: {
  index: number; title: string; artists: string; videoId?: string; videoCaption?: string; status: string | null;
  isNow: boolean; playable: boolean; onPress: () => void; onSearch?: () => void; onLongPress?: () => void;
}) {
  return (
    <Pressable onPress={playable ? onPress : undefined} onLongPress={onLongPress} delayLongPress={450} style={[s.row, isNow && s.rowNow]}>
      <View style={s.thumb}>
        {videoId
          ? <Cover videoId={videoId} size={46} radius={radius.sm} seed={title} />
          : <View style={s.num}><Text style={s.numText}>{String(index).padStart(2, '0')}</Text></View>}
        {isNow && (
          <View style={s.nowOverlay}><Icon name="musical-notes" size={18} color="#FFFFFF" /></View>
        )}
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
  card: { borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.dark },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingBottom: 14, paddingTop: 44, gap: 2 },
  name: { color: '#FFFFFF', fontSize: 17, lineHeight: 20, fontWeight: '800', letterSpacing: -0.3 },
  meta: { color: 'rgba(255,255,255,0.72)', fontSize: 12 },
  track: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden', marginTop: 6 },
  trackFill: { height: 3, backgroundColor: 'rgba(255,255,255,0.9)' },
  badge: { position: 'absolute', top: 10, left: 10, backgroundColor: colors.terracotta, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  del: { position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(20,10,4,0.45)', alignItems: 'center', justifyContent: 'center' },
  /* hero */
  heroWrap: { borderRadius: radius.xl, overflow: 'hidden' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, overflow: 'hidden' },
  heroBlob: { position: 'absolute', width: 220, height: 220, borderRadius: 110, right: -70, top: -90, backgroundColor: 'rgba(255,255,255,0.12)' },
  heroCover: { borderRadius: radius.md, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  heroKicker: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  heroName: { color: '#FFFFFF', fontSize: 24, lineHeight: 27, fontWeight: '900', letterSpacing: -0.7 },
  heroMeta: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  heroGo: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.onDark, alignItems: 'center', justifyContent: 'center' },
  /* filas */
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, paddingRight: 16,
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
  },
  rowNow: { borderColor: colors.accent, backgroundColor: '#F8EDE3' },
  thumb: { width: 46, height: 46, borderRadius: radius.sm, overflow: 'hidden' },
  num: { width: 46, height: 46, borderRadius: radius.sm, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
  nowOverlay: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(154,90,58,0.78)', alignItems: 'center', justifyContent: 'center' },
  searchBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
  numText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  title: { color: colors.text, fontSize: 15, fontWeight: '700', letterSpacing: -0.1 },
  artist: { color: colors.muted, fontSize: 13 },
  caption: { color: colors.faint, fontSize: 11, fontStyle: 'italic' },
});
