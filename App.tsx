import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { runMatching, QueueSummary } from './src/core/matching/matchQueue';
import { SearchFn } from './src/core/matching/matchTrack';
import { Db } from './src/db/database';
import { makeQueueDeps } from './src/db/matchingAdapter';
import { openDb } from './src/db/openDb';
import { ChosenVideo, countByStatus, getChosenVideos, getPlaylistEntries, PlaylistEntry } from './src/db/repository';
import { ImportError } from './src/importers/errors';
import { importSpotifyPlaylist, ImportSummary } from './src/importers/spotify/importPlaylist';
import { searchYtMusic } from './src/providers/youtubeMusic/search';
import { buildQueue, QueueItem, stepIndex } from './src/core/player/queue';
import { ReviewScreen } from './src/ui/ReviewScreen';
import { YouTubePlayer } from './src/ui/YouTubePlayer';

const search: SearchFn = (query, opts) => searchYtMusic(query, { filter: opts?.filter });

const STATUS_ICON: Record<string, string> = { auto: '✅', manual: '👆', pending: '❓', none: '✖️' };

export default function App() {
  const [db, setDb] = useState<Db | null>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [entries, setEntries] = useState<PlaylistEntry[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [matching, setMatching] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; title: string } | null>(null);
  const [chosen, setChosen] = useState<Record<string, ChosenVideo>>({});
  const [screen, setScreen] = useState<'home' | 'review'>('home');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [nowIdx, setNowIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [debugOut, setDebugOut] = useState<string | null>(null);
  const signal = useRef({ aborted: false });

  useEffect(() => {
    openDb().then(async d => { setDb(d); setCounts(await countByStatus(d)); }).catch(e => setError(`Error de base de datos: ${String(e)}`));
  }, []);

  const refresh = useCallback(async (d: Db, playlistId: string) => {
    setEntries(await getPlaylistEntries(d, playlistId));
    setChosen(await getChosenVideos(d, playlistId));
    setCounts(await countByStatus(d));
  }, []);

  const onImport = async () => {
    if (!db || busy) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const s = await importSpotifyPlaylist(db, url);
      setSummary(s);
      await refresh(db, s.playlistId);
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

  const onMatch = async () => {
    if (!db || !summary || matching) return;
    setMatching(true); setError(null); setMessage(null);
    signal.current = { aborted: false };
    try {
      const s: QueueSummary = await runMatching(
        entries.map(e => e.track),
        makeQueueDeps(db, search),
        {
          signal: signal.current,
          onProgress: p => setProgress({ done: p.done, total: p.total, title: p.track.title }),
        },
      );
      await refresh(db, summary.playlistId);
      const parts = [
        `${s.auto} automáticas`, `${s.review} a revisar`, `${s.none} sin resultado`,
        s.skipped ? `${s.skipped} ya resueltas` : '', s.errors ? `${s.errors} errores` : '',
      ].filter(Boolean);
      setMessage(`Matching: ${parts.join(' · ')}.`);
      if (s.aborted) setMessage(m => `Cancelado. ${m ?? ''}`);
      if (s.stoppedByErrors) {
        setError('Se detuvo por errores seguidos (¿sin conexión o YouTube bloqueando?). Prueba "Probar YT Music".');
      }
    } catch (e) {
      setError(`Error inesperado: ${String(e)}`);
    } finally {
      setMatching(false); setProgress(null);
    }
  };

  const onDebug = async () => {
    setDebugOut('Buscando…');
    try {
      const r = await searchYtMusic('The Weeknd Blinding Lights');
      setDebugOut(
        r.length === 0
          ? 'Sin resultados con filtro "Canciones". Probando sin filtro…\n' +
            JSON.stringify((await searchYtMusic('The Weeknd Blinding Lights', { filter: false })).slice(0, 5), null, 1)
          : JSON.stringify(r.slice(0, 5), null, 1),
      );
    } catch (e) {
      setDebugOut(`Error: ${String(e)}`);
    }
  };

  const startAt = (trackId?: string) => {
    const q = buildQueue(entries);
    if (q.length === 0) return;
    const idx = trackId ? q.findIndex(i => i.trackId === trackId) : 0;
    setQueue(q); setNowIdx(Math.max(0, idx)); setPlaying(true);
  };
  const step = (dir: 1 | -1) => {
    if (nowIdx === null) return;
    const n = stepIndex(nowIdx, queue.length, dir);
    if (n === null) { if (dir === 1) { setNowIdx(null); setPlaying(false); } return; }
    setNowIdx(n); setPlaying(true);
  };
  const onPlayerError = () => {
    const cur = nowIdx !== null ? queue[nowIdx] : null;
    setError(`No se pudo reproducir "${cur?.title ?? ''}" (puede no permitir reproducción embebida). Pasando a la siguiente.`);
    step(1);
  };

  if (screen === 'review' && db) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe}>
          <ReviewScreen db={db} onClose={() => { setScreen('home'); refresh(db, summary?.playlistId ?? ''); }} />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>PROYECTO PRIVADO · V0.7</Text>
          <Text style={styles.title}>Importar playlist</Text>
          <View style={styles.card}>
            <Text style={styles.body}>Pega el enlace de una playlist pública de Spotify.</Text>
            <TextInput
              style={styles.input} value={url} onChangeText={setUrl} placeholder="https://open.spotify.com/playlist/…"
              placeholderTextColor="#5B6678" autoCapitalize="none" autoCorrect={false} keyboardType="url"
            />
            <Pressable style={[styles.button, (!db || busy || matching || !url.trim()) && styles.buttonOff]} onPress={onImport}
              disabled={!db || busy || matching || !url.trim()}>
              {busy ? <ActivityIndicator color="#0B0D12" /> : <Text style={styles.buttonText}>Importar</Text>}
            </Pressable>
            {message && <Text style={styles.ok}>{message}</Text>}
            {error && <Text style={styles.err}>{error}</Text>}
          </View>

          {summary && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{summary.name}</Text>
              {!matching ? (
                <Pressable style={[styles.button, busy && styles.buttonOff]} onPress={onMatch} disabled={busy}>
                  <Text style={styles.buttonText}>Buscar coincidencias</Text>
                </Pressable>
              ) : (
                <>
                  <Text style={styles.body} numberOfLines={1}>
                    {progress ? `${progress.done}/${progress.total} · ${progress.title}` : 'Iniciando…'}
                  </Text>
                  <Pressable style={[styles.button, styles.buttonSecondary]} onPress={() => { signal.current.aborted = true; }}>
                    <Text style={styles.buttonTextLight}>Cancelar</Text>
                  </Pressable>
                </>
              )}
              <Text style={styles.body}>
                ✅ {counts.auto ?? 0} · 👆 {counts.manual ?? 0} · ❓ {counts.pending ?? 0} · ✖️ {counts.none ?? 0}
              </Text>
              {entries.some(e => e.videoId) && (
                <Pressable style={styles.button} onPress={() => startAt()}>
                  <Text style={styles.buttonText}>▶ Reproducir playlist</Text>
                </Pressable>
              )}
              {(counts.pending ?? 0) > 0 && (
                <Pressable style={styles.button} onPress={() => setScreen('review')}>
                  <Text style={styles.buttonText}>Revisar dudosas ({counts.pending})</Text>
                </Pressable>
              )}
              {entries.slice(0, 15).map(e => {
                const v = chosen[e.track.id];
                return (
                  <Pressable key={e.position} onPress={() => startAt(e.track.id)} disabled={!v}>
                    <Text style={styles.body} numberOfLines={1}>
                      {STATUS_ICON[e.status ?? ''] ?? '·'} {e.position + 1}. {e.track.title} — {e.track.artists.join(', ')}
                    </Text>
                    {v && (
                      <Text style={styles.sub} numberOfLines={1}>
                        ↳ {v.title} — {v.artists.join(', ')}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
              {entries.length > 15 && <Text style={styles.body}>… y {entries.length - 15} más</Text>}
            </View>
          )}

          <View style={styles.card}>
            <Pressable style={[styles.button, styles.buttonSecondary]} onPress={onDebug}>
              <Text style={styles.buttonTextLight}>Probar YT Music</Text>
            </Pressable>
            {debugOut && <Text style={styles.mono}>{debugOut}</Text>}
          </View>
        </ScrollView>
        {nowIdx !== null && queue[nowIdx] && (
          <View style={styles.player}>
            <YouTubePlayer
              videoId={queue[nowIdx].videoId}
              playing={playing}
              onEnded={() => step(1)}
              onError={onPlayerError}
              onPlayingChange={setPlaying}
            />
            <Text style={styles.cardTitle} numberOfLines={1}>{queue[nowIdx].title}</Text>
            <Text style={styles.body} numberOfLines={1}>{queue[nowIdx].artists.join(', ')}</Text>
            <View style={styles.controls}>
              <Pressable style={styles.ctl} onPress={() => step(-1)}><Text style={styles.ctlText}>⏮</Text></Pressable>
              <Pressable style={styles.ctl} onPress={() => setPlaying(p => !p)}><Text style={styles.ctlText}>{playing ? '⏸' : '▶'}</Text></Pressable>
              <Pressable style={styles.ctl} onPress={() => step(1)}><Text style={styles.ctlText}>⏭</Text></Pressable>
              <Pressable style={styles.ctl} onPress={() => { setNowIdx(null); setPlaying(false); }}><Text style={styles.ctlText}>✕</Text></Pressable>
            </View>
          </View>
        )}
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
  player: { backgroundColor: '#171C26', padding: 24, paddingTop: 12, paddingBottom: 12, gap: 6 },
  controls: { flexDirection: 'row', justifyContent: 'space-around' },
  ctl: { padding: 10 },
  ctlText: { color: '#FFFFFF', fontSize: 24 },
  sub: { color: '#70D6A4', fontSize: 12, paddingLeft: 22 },
  mono: { color: '#B6C0D0', fontSize: 11, fontFamily: 'Courier' },
  input: { backgroundColor: '#0B0D12', color: '#FFFFFF', borderRadius: 12, padding: 12, fontSize: 14 },
  button: { backgroundColor: '#70D6A4', borderRadius: 12, padding: 14, alignItems: 'center' },
  buttonSecondary: { backgroundColor: '#2A3242' },
  buttonOff: { opacity: 0.4 },
  buttonText: { color: '#0B0D12', fontWeight: '800', fontSize: 15 },
  buttonTextLight: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  ok: { color: '#70D6A4', fontSize: 13, fontWeight: '600' },
  err: { color: '#FF8A8A', fontSize: 13, fontWeight: '600' },
});
