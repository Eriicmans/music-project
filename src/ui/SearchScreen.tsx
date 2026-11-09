import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { parseTitle } from '../core/matching/parseTitle';
import { SearchFn } from '../core/matching/matchTrack';
import { searchSongs } from '../core/search/searchSongs';
import { Db } from '../db/database';
import { YoutubeTrackInput } from '../db/repository';
import { YtResult } from '../providers/youtubeMusic/search';
import { AddToPlaylistSheet } from './AddToPlaylistSheet';
import { Disc, Icon, IconBtn } from './kit';
import { colors, radius, type } from './theme';

const fmt = (sec?: number): string => {
  if (sec === undefined) return '';
  return `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
};

const toInput = (r: YtResult): YoutubeTrackInput => ({
  videoId: r.videoId, title: r.title, artists: r.artists, album: r.album,
  durationMs: r.durationSec !== undefined ? r.durationSec * 1000 : undefined,
  version: parseTitle(r.title, r.artists).version,
});

interface Props {
  db: Db;
  search: SearchFn;
  /** Videoid que suena ahora (se resalta). */
  nowVideoId?: string;
  onPlay: (r: YtResult) => void;
}

/** Pestaña Buscar: busca canciones en YouTube Music, las reproduce y las añade a una playlist. */
export function SearchScreen({ db, search, nowVideoId, onPlay }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<YtResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState<YtResult | null>(null);
  const reqId = useRef(0);

  const run = async () => {
    const text = q.trim();
    if (!text) return;
    const id = ++reqId.current;
    setLoading(true); setError(null); setNotice(null);
    try {
      const r = await searchSongs(text, search);
      if (id === reqId.current) setResults(r);
    } catch (e) {
      if (id === reqId.current) { setResults(null); setError(`No se pudo buscar: ${(e as Error).message}`); }
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  };

  const clear = () => { reqId.current++; setQ(''); setResults(null); setError(null); setLoading(false); };

  return (
    <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
      <Text style={type.small}>YouTube Music</Text>
      <Text style={type.h1}>Buscar</Text>

      <View style={s.searchRow}>
        <View style={s.search}>
          <Icon name="search" size={18} color={colors.faint} />
          <TextInput
            style={s.input} value={q} onChangeText={setQ} placeholder="Canciones, artistas…"
            placeholderTextColor={colors.faint} autoCorrect={false} returnKeyType="search"
            onSubmitEditing={run}
          />
          {q.length > 0 && (
            <Pressable onPress={clear} hitSlop={10}><Icon name="close-circle" size={18} color={colors.faint} /></Pressable>
          )}
        </View>
        <IconBtn name="arrow-forward" tone="accent" size={48} onPress={run} disabled={loading || !q.trim()} />
      </View>

      {notice && <View style={s.notice}><Text style={s.noticeText}>{notice}</Text></View>}
      {error && <View style={[s.notice, { backgroundColor: colors.dangerBg }]}><Text style={[s.noticeText, { color: colors.danger }]}>{error}</Text></View>}
      {loading && <ActivityIndicator color={colors.accent} />}
      {!loading && results === null && !error && (
        <Text style={type.body}>Escribe lo que quieras escuchar. Toca un resultado para reproducirlo o el + para añadirlo a una playlist.</Text>
      )}
      {!loading && results && results.length === 0 && <Text style={type.body}>Sin resultados. Prueba con otras palabras.</Text>}

      {!loading && results?.map(r => {
        const isNow = r.videoId === nowVideoId;
        const meta = [r.artists.join(', ') || 'Artista desconocido', r.album, fmt(r.durationSec)].filter(Boolean).join(' · ');
        return (
          <Pressable key={r.videoId} onPress={() => onPlay(r)} style={s.row}>
            <View style={[s.cover, isNow && { backgroundColor: colors.accent }]}>
              {isNow ? <Icon name="musical-notes" size={20} color={colors.onAccent} /> : <Disc seed={r.title + r.artists.join()} size={40} />}
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={[s.title, isNow && { color: colors.accent }]} numberOfLines={1}>{r.title}</Text>
              <Text style={s.meta} numberOfLines={1}>{meta}</Text>
              {r.kind === 'video' && <Text style={s.kind}>VÍDEO</Text>}
            </View>
            <IconBtn name="add" tone="dark" size={38} iconSize={20} onPress={() => setAdding(r)} />
          </Pressable>
        );
      })}

      {adding && (
        <AddToPlaylistSheet
          db={db} track={toInput(adding)} onClose={() => setAdding(null)}
          onDone={(name, added) => {
            setNotice(added ? `"${adding.title}" añadida a ${name}.` : `"${adding.title}" ya estaba en ${name}.`);
            setAdding(null);
          }}
        />
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { padding: 24, gap: 14, paddingBottom: 32 },
  searchRow: { flexDirection: 'row', gap: 10 },
  search: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 14,
    backgroundColor: colors.chip, borderRadius: radius.md,
  },
  input: { flex: 1, color: colors.text, fontSize: 15 },
  notice: { backgroundColor: colors.chip, borderRadius: radius.md, padding: 14 },
  noticeText: { color: colors.text, fontSize: 13, lineHeight: 19 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, paddingRight: 12,
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
  },
  cover: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 15, fontWeight: '700', letterSpacing: -0.1 },
  meta: { color: colors.muted, fontSize: 13 },
  kind: { color: colors.faint, fontSize: 10, letterSpacing: 2, fontWeight: '800' },
});
