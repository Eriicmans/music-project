import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { defaultManualQuery, ManualResult, searchManual } from '../core/matching/manualSearch';
import { SearchFn } from '../core/matching/matchTrack';
import { Db } from '../db/database';
import { resolveManualFromSearch } from '../db/repository';
import { Track } from '../models/Track';
import { Btn, Icon, IconBtn } from './kit';
import { colors, radius, type } from './theme';

const fmt = (ms?: number): string => {
  if (!ms) return '—';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

interface Props {
  db: Db;
  track: Track;
  /** Vídeo asignado ahora mismo a la canción (se marca como "Elegida"). */
  currentVideoId?: string | null;
  search: SearchFn;
  onClose: () => void;
  /** Se llama tras guardar la elección; el padre refresca sus datos. */
  onPicked: (video: { title: string; artists: string[] }) => void;
}

/** Búsqueda manual en YouTube Music para elegir el vídeo exacto de una canción. */
export function ManualSearch({ db, track, currentVideoId, search, onClose, onPicked }: Props) {
  const [q, setQ] = useState(() => defaultManualQuery(track));
  const [results, setResults] = useState<ManualResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const run = useCallback(async (text: string) => {
    const id = ++reqId.current;
    setLoading(true); setError(null);
    try {
      const r = await searchManual(track, text, search);
      if (id === reqId.current) setResults(r);
    } catch (e) {
      if (id === reqId.current) { setResults(null); setError(`No se pudo buscar: ${(e as Error).message}`); }
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [track, search]);

  useEffect(() => { run(defaultManualQuery(track)); }, [run, track]);

  const pick = async (m: ManualResult) => {
    if (saving) return;
    setSaving(true); setError(null);
    try {
      await resolveManualFromSearch(db, track.id, m.candidate, m.result);
      onPicked({ title: m.candidate.title, artists: m.candidate.artists });
    } catch (e) {
      setError(`No se pudo guardar: ${String(e)}`);
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.root}>
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <Text style={type.small}>Búsqueda manual</Text>
              <Text style={type.h2}>Elegir vídeo</Text>
            </View>
            <IconBtn name="close" onPress={onClose} />
          </View>

          <View style={s.original}>
            <Text style={s.originalLabel}>EN SPOTIFY</Text>
            <Text style={s.originalTitle} numberOfLines={2}>{track.title}</Text>
            <Text style={s.originalMeta}>
              {track.artists.join(', ')} · {fmt(track.durationMs)}
              {track.version !== 'studio' ? ` · ${track.version}` : ''}
            </Text>
          </View>

          <View style={s.searchRow}>
            <View style={s.search}>
              <Icon name="search" size={18} color={colors.faint} />
              <TextInput
                style={s.input} value={q} onChangeText={setQ} placeholder="Artista y título…"
                placeholderTextColor={colors.faint} autoCorrect={false} returnKeyType="search"
                onSubmitEditing={() => run(q)} selectTextOnFocus
              />
            </View>
            <IconBtn name="arrow-forward" tone="accent" size={48} onPress={() => run(q)} disabled={loading || !q.trim()} />
          </View>

          {error && <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View>}
          {loading && <ActivityIndicator color={colors.accent} />}
          {!loading && results && results.length === 0 && (
            <Text style={type.body}>Sin resultados. Prueba con menos palabras o solo el título.</Text>
          )}

          {!loading && results?.map(m => {
            const c = m.candidate;
            const notes = [...m.result.conflicts, ...m.result.warnings];
            const isCurrent = c.externalId === currentVideoId;
            return (
              <View key={c.externalId} style={[s.card, isCurrent && s.cardCurrent]}>
                <View style={s.cardHead}>
                  <Text style={s.kind}>{m.kind === 'song' ? 'CANCIÓN' : 'VÍDEO'}{isCurrent ? ' · ELEGIDA' : ''}</Text>
                  <Text style={s.score}>{Math.round(m.result.score)} pts</Text>
                </View>
                <Text style={s.cardTitle}>{c.title}</Text>
                <Text style={type.body}>
                  {c.artists.join(', ') || 'Artista desconocido'}
                  {c.album ? ` · ${c.album}` : ''} · {fmt(c.durationMs)}
                </Text>
                {m.result.reasons.length > 0 && <Text style={s.good}>{m.result.reasons.join(' · ')}</Text>}
                {notes.length > 0 && <Text style={s.warn}>{notes.join(' · ')}</Text>}
                <View style={s.row}>
                  <Btn flex label={isCurrent ? 'Ya elegida' : 'Elegir'} disabled={saving || isCurrent} onPress={() => pick(m)} />
                  <Btn flex tone="soft" icon="play" label="Escuchar"
                    onPress={() => Linking.openURL(`https://music.youtube.com/watch?v=${c.externalId}`)} />
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 24, gap: 14, paddingBottom: 40 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  original: { backgroundColor: colors.dark, borderRadius: radius.xl, padding: 18, gap: 4 },
  originalLabel: { color: colors.onDarkMuted, fontSize: 10, letterSpacing: 2, fontWeight: '800' },
  originalTitle: { color: colors.onDark, fontSize: 22, lineHeight: 27, fontWeight: '800', letterSpacing: -0.5 },
  originalMeta: { color: colors.onDarkMuted, fontSize: 14 },
  searchRow: { flexDirection: 'row', gap: 10 },
  search: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 14,
    backgroundColor: colors.chip, borderRadius: radius.md,
  },
  input: { flex: 1, color: colors.text, fontSize: 15 },
  errorBox: { backgroundColor: colors.dangerBg, borderRadius: radius.md, padding: 14 },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, gap: 6, borderWidth: 1, borderColor: colors.line },
  cardCurrent: { borderColor: colors.gold, borderWidth: 2 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between' },
  kind: { color: colors.faint, fontSize: 10, letterSpacing: 2, fontWeight: '800' },
  score: { color: colors.gold, fontSize: 12, fontWeight: '800' },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  good: { color: colors.gold, fontSize: 12 },
  warn: { color: colors.terracotta, fontSize: 12 },
  row: { flexDirection: 'row', gap: 10, marginTop: 6 },
});
