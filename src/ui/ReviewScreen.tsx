import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Db } from '../db/database';
import { listPendingReviews, markNone, PendingReview, resolveManual } from '../db/repository';
import { Btn } from './kit';
import { colors, radius, type } from './theme';

const fmt = (ms?: number): string => {
  if (!ms) return '—';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function ReviewScreen({ db, onChanged }: { db: Db; onChanged?: () => void }) {
  const [items, setItems] = useState<PendingReview[] | null>(null);
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setItems(await listPendingReviews(db));
    setI(0);
  }, [db]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); await load(); onChanged?.(); } finally { setBusy(false); }
  };

  const cur = items && items.length > 0 ? items[i % items.length] : null;

  return (
    <ScrollView contentContainerStyle={s.container}>
      <Text style={type.small}>Coincidencias dudosas</Text>
      <Text style={type.h1}>Revisar</Text>

      {items === null && <ActivityIndicator color={colors.accent} />}
      {items && items.length === 0 && (
        <View style={s.empty}><Text style={type.body}>No queda nada pendiente. Todo en orden.</Text></View>
      )}

      {cur && items && (
        <>
          <Text style={type.small}>{(i % items.length) + 1} de {items.length} pendientes</Text>

          <View style={s.original}>
            <Text style={s.originalLabel}>EN SPOTIFY</Text>
            <Text style={s.originalTitle}>{cur.track.title}</Text>
            <Text style={s.originalMeta}>
              {cur.track.artists.join(', ')} · {fmt(cur.track.durationMs)}
              {cur.track.version !== 'studio' ? ` · ${cur.track.version}` : ''}
            </Text>
          </View>

          {cur.candidates.slice(0, 3).map(c => {
            const notes = [...c.conflicts, ...c.warnings];
            return (
              <View key={c.externalId} style={s.cand}>
                <View style={s.candHead}>
                  <Text style={s.candLabel}>CANDIDATO</Text>
                  <Text style={s.score}>{Math.round(c.score)} pts</Text>
                </View>
                <Text style={s.candTitle}>{c.title}</Text>
                <Text style={type.body}>{c.artists.join(', ') || 'Artista desconocido'} · {fmt(c.durationMs)}</Text>
                {c.reasons.length > 0 && <Text style={s.good}>{c.reasons.join(' · ')}</Text>}
                {notes.length > 0 && <Text style={s.warn}>{notes.join(' · ')}</Text>}
                <View style={s.row}>
                  <Btn flex label="Elegir" disabled={busy} onPress={() => act(() => resolveManual(db, cur.track.id, c.externalId))} />
                  <Btn flex tone="soft" icon="play" label="Escuchar" onPress={() => Linking.openURL(`https://music.youtube.com/watch?v=${c.externalId}`)} />
                </View>
              </View>
            );
          })}

          <View style={s.row}>
            <Btn flex tone="soft" label="Ninguno es correcto" disabled={busy} onPress={() => act(() => markNone(db, cur.track.id))} />
            {items.length > 1 && <Btn flex tone="soft" label="Saltar" onPress={() => setI(n => n + 1)} />}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { padding: 24, gap: 14, paddingBottom: 32 },
  empty: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 18, borderWidth: 1, borderColor: colors.line },
  original: { backgroundColor: colors.dark, borderRadius: radius.xl, padding: 20, gap: 4 },
  originalLabel: { color: colors.onDarkMuted, fontSize: 10, letterSpacing: 2, fontWeight: '800' },
  originalTitle: { color: colors.onDark, fontSize: 24, lineHeight: 29, fontWeight: '800', letterSpacing: -0.5 },
  originalMeta: { color: colors.onDarkMuted, fontSize: 14 },
  cand: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, gap: 6, borderWidth: 1, borderColor: colors.line },
  candHead: { flexDirection: 'row', justifyContent: 'space-between' },
  candLabel: { color: colors.faint, fontSize: 10, letterSpacing: 2, fontWeight: '800' },
  score: { color: colors.gold, fontSize: 12, fontWeight: '800' },
  candTitle: { color: colors.text, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  good: { color: colors.gold, fontSize: 12 },
  warn: { color: colors.terracotta, fontSize: 12 },
  row: { flexDirection: 'row', gap: 10, marginTop: 6 },
});