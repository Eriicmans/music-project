import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Db } from '../db/database';
import { listPendingReviews, markNone, PendingReview, resolveManual } from '../db/repository';

const fmt = (ms?: number): string => {
  if (!ms) return '—';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function ReviewScreen({ db, onClose }: { db: Db; onClose: () => void }) {
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
    try { await fn(); await load(); } finally { setBusy(false); }
  };

  const cur = items && items.length > 0 ? items[i % items.length] : null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={onClose}><Text style={styles.link}>← Volver</Text></Pressable>
      <Text style={styles.title}>Revisar coincidencias</Text>

      {items === null && <ActivityIndicator color="#70D6A4" />}
      {items && items.length === 0 && <Text style={styles.body}>No quedan canciones pendientes. 🎉</Text>}

      {cur && items && (
        <>
          <Text style={styles.body}>{(i % items.length) + 1} de {items.length} pendientes</Text>
          <View style={styles.card}>
            <Text style={styles.label}>SPOTIFY</Text>
            <Text style={styles.cardTitle}>{cur.track.title}</Text>
            <Text style={styles.body}>
              {cur.track.artists.join(', ')} · {fmt(cur.track.durationMs)}
              {cur.track.version !== 'studio' ? ` · ${cur.track.version}` : ''}
            </Text>
          </View>

          {cur.candidates.slice(0, 3).map(c => {
            const notes = [...c.conflicts, ...c.warnings];
            return (
              <View key={c.externalId} style={styles.card}>
                <Text style={styles.label}>CANDIDATO · {Math.round(c.score)} pts</Text>
                <Text style={styles.cardTitle}>{c.title}</Text>
                <Text style={styles.body}>{c.artists.join(', ') || 'Artista desconocido'} · {fmt(c.durationMs)}</Text>
                {c.reasons.length > 0 && <Text style={styles.good}>{c.reasons.join(' · ')}</Text>}
                {notes.length > 0 && <Text style={styles.warn}>{notes.join(' · ')}</Text>}
                <View style={styles.row}>
                  <Pressable style={[styles.btn, styles.btnOk, busy && styles.off]} disabled={busy}
                    onPress={() => act(() => resolveManual(db, cur.track.id, c.externalId))}>
                    <Text style={styles.btnOkText}>Elegir este</Text>
                  </Pressable>
                  <Pressable style={[styles.btn, styles.btnGrey]}
                    onPress={() => Linking.openURL(`https://music.youtube.com/watch?v=${c.externalId}`)}>
                    <Text style={styles.btnText}>Escuchar</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}

          <View style={styles.row}>
            <Pressable style={[styles.btn, styles.btnGrey, busy && styles.off]} disabled={busy}
              onPress={() => act(() => markNone(db, cur.track.id))}>
              <Text style={styles.btnText}>Ninguno es correcto</Text>
            </Pressable>
            {items.length > 1 && (
              <Pressable style={[styles.btn, styles.btnGrey]} onPress={() => setI(n => n + 1)}>
                <Text style={styles.btnText}>Saltar</Text>
              </Pressable>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 14 },
  link: { color: '#70D6A4', fontSize: 15, fontWeight: '700' },
  title: { color: '#FFFFFF', fontSize: 30, fontWeight: '800' },
  card: { backgroundColor: '#171C26', borderRadius: 18, padding: 16, gap: 8 },
  label: { color: '#8D9AAF', fontSize: 11, letterSpacing: 1.5, fontWeight: '700' },
  cardTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  body: { color: '#B6C0D0', fontSize: 14, lineHeight: 20 },
  good: { color: '#70D6A4', fontSize: 12 },
  warn: { color: '#FFB86B', fontSize: 12 },
  row: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  btnOk: { backgroundColor: '#70D6A4' },
  btnGrey: { backgroundColor: '#2A3242' },
  btnOkText: { color: '#0B0D12', fontWeight: '800' },
  btnText: { color: '#FFFFFF', fontWeight: '700' },
  off: { opacity: 0.4 },
});
