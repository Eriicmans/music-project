import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Db } from './src/db/database';
import { openDb } from './src/db/openDb';
import { getPlaylistEntries, PlaylistEntry } from './src/db/repository';
import { ImportError } from './src/importers/errors';
import { importSpotifyPlaylist, ImportSummary } from './src/importers/spotify/importPlaylist';

export default function App() {
  const [db, setDb] = useState<Db | null>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [entries, setEntries] = useState<PlaylistEntry[]>([]);

  useEffect(() => {
    openDb().then(setDb).catch(e => setError(`Error de base de datos: ${String(e)}`));
  }, []);

  const onImport = async () => {
    if (!db || busy) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const s = await importSpotifyPlaylist(db, url);
      setSummary(s);
      setEntries(await getPlaylistEntries(db, s.playlistId));
      setMessage(
        `${s.total} canciones importadas (${s.newTracks} nuevas).` +
        (s.skipped ? ` ${s.skipped} omitidas (locales/episodios).` : '') +
        (s.partial ? ' Aviso: Spotify solo expone las primeras 100; puede haber más en la playlist.' : ''),
      );
    } catch (e) {
      setError(e instanceof ImportError ? e.message : `Error inesperado: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>PROYECTO PRIVADO · V0.4</Text>
          <Text style={styles.title}>Importar playlist</Text>
          <View style={styles.card}>
            <Text style={styles.body}>Pega el enlace de una playlist pública de Spotify.</Text>
            <TextInput
              style={styles.input} value={url} onChangeText={setUrl} placeholder="https://open.spotify.com/playlist/…"
              placeholderTextColor="#5B6678" autoCapitalize="none" autoCorrect={false} keyboardType="url"
            />
            <Pressable style={[styles.button, (!db || busy || !url.trim()) && styles.buttonOff]} onPress={onImport}
              disabled={!db || busy || !url.trim()}>
              {busy ? <ActivityIndicator color="#0B0D12" /> : <Text style={styles.buttonText}>Importar</Text>}
            </Pressable>
            {message && <Text style={styles.ok}>{message}</Text>}
            {error && <Text style={styles.err}>{error}</Text>}
          </View>

          {summary && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{summary.name}</Text>
              {entries.slice(0, 15).map(e => (
                <Text key={e.position} style={styles.body} numberOfLines={1}>
                  {e.position + 1}. {e.track.title} — {e.track.artists.join(', ')}
                </Text>
              ))}
              {entries.length > 15 && <Text style={styles.body}>… y {entries.length - 15} más</Text>}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B0D12' },
  container: { padding: 24, paddingTop: 24, gap: 18 },
  eyebrow: { color: '#8D9AAF', fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  title: { color: '#FFFFFF', fontSize: 34, lineHeight: 40, fontWeight: '800' },
  card: { backgroundColor: '#171C26', borderRadius: 18, padding: 18, gap: 12 },
  cardTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  body: { color: '#B6C0D0', fontSize: 14, lineHeight: 21 },
  input: { backgroundColor: '#0B0D12', color: '#FFFFFF', borderRadius: 12, padding: 12, fontSize: 14 },
  button: { backgroundColor: '#70D6A4', borderRadius: 12, padding: 14, alignItems: 'center' },
  buttonOff: { opacity: 0.4 },
  buttonText: { color: '#0B0D12', fontWeight: '800', fontSize: 15 },
  ok: { color: '#70D6A4', fontSize: 13, fontWeight: '600' },
  err: { color: '#FF8A8A', fontSize: 13, fontWeight: '600' },
});
