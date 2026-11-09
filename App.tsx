import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { runMatching, QueueSummary } from './src/core/matching/matchQueue';
import { SearchFn } from './src/core/matching/matchTrack';
import { Track } from './src/models/Track';
import { buildQueue, QueueItem, shuffleQueue, stepIndex } from './src/core/player/queue';
import { Db } from './src/db/database';
import { makeQueueDeps } from './src/db/matchingAdapter';
import { openDb } from './src/db/openDb';
import {
  ChosenVideo, countByStatus, deletePlaylist, getChosenVideos, getPlaylistEntries, listPlaylists, PlaylistEntry, PlaylistInfo,
} from './src/db/repository';
import { ImportError } from './src/importers/errors';
import { importSpotifyPlaylist } from './src/importers/spotify/importPlaylist';
import { searchYtMusic, YtResult } from './src/providers/youtubeMusic/search';
import { PlaylistCard, TrackRow } from './src/ui/cards';
import { Btn, Chip, Disc, Icon, IconBtn } from './src/ui/kit';
import { ManualSearch } from './src/ui/ManualSearch';
import { SearchScreen } from './src/ui/SearchScreen';
import { PlayerDock } from './src/ui/PlayerDock';
import { ReviewScreen } from './src/ui/ReviewScreen';
import { Tab, TabBar } from './src/ui/TabBar';
import { colors, fonts, radius, type } from './src/ui/theme';

const search: SearchFn = (query, opts) => searchYtMusic(query, { filter: opts?.filter });

type LibFilter = 'all' | 'complete' | 'doubts';
type TrackFilter = 'all' | 'pending' | 'none';

export default function App() {
  const { width } = useWindowDimensions();
  const cardW = Math.floor((width - 48 - 12) / 2);

  const [db, setDb] = useState<Db | null>(null);
  const [tab, setTab] = useState<Tab>('library');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<{ playlistId: string; name: string } | null>(null);
  const [playlists, setPlaylists] = useState<PlaylistInfo[]>([]);
  const [entries, setEntries] = useState<PlaylistEntry[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [chosen, setChosen] = useState<Record<string, ChosenVideo>>({});
  const [matching, setMatching] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; title: string } | null>(null);
  const [query, setQuery] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [libFilter, setLibFilter] = useState<LibFilter>('all');
  const [trackFilter, setTrackFilter] = useState<TrackFilter>('all');
  const [base, setBase] = useState<QueueItem[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [nowIdx, setNowIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [manualFor, setManualFor] = useState<Track | null>(null);
  const [debugOut, setDebugOut] = useState<string | null>(null);
  const signal = useRef({ aborted: false });

  useEffect(() => {
    openDb()
      .then(async d => { setDb(d); setCounts(await countByStatus(d)); setPlaylists(await listPlaylists(d)); })
      .catch(e => setError(`Error de base de datos: ${String(e)}`));
  }, []);

  const refresh = useCallback(async (d: Db, playlistId: string) => {
    setEntries(await getPlaylistEntries(d, playlistId));
    setChosen(await getChosenVideos(d, playlistId));
    setCounts(await countByStatus(d));
  }, []);

  const goTab = async (t: Tab) => {
    setTab(t);
    if (t === 'library' && db) {
      setPlaylists(await listPlaylists(db));
      setCounts(await countByStatus(db));
      if (current) await refresh(db, current.playlistId);
    }
  };

  /* ---------- Importar ---------- */
  const onImport = async () => {
    if (!db || busy) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const sum = await importSpotifyPlaylist(db, url);
      setCurrent({ playlistId: sum.playlistId, name: sum.name });
      setTrackFilter('all'); setShowImport(false); setUrl('');
      setPlaylists(await listPlaylists(db));
      await refresh(db, sum.playlistId);
      setMessage(
        `${sum.total} canciones importadas (${sum.newTracks} nuevas).` +
        (sum.skipped ? ` ${sum.skipped} omitidas (locales/episodios).` : '') +
        (sum.partial ? ' Spotify solo expone las primeras 100; puede haber más en la playlist.' : ''),
      );
    } catch (e) {
      setError(e instanceof ImportError ? e.message : `Error inesperado: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  /* ---------- Biblioteca ---------- */
  const openPlaylist = async (p: PlaylistInfo) => {
    if (!db) return;
    setCurrent({ playlistId: p.id, name: p.name }); setTrackFilter('all'); setMessage(null); setError(null);
    await refresh(db, p.id);
  };
  const closePlaylist = async () => {
    setCurrent(null); setMessage(null); setError(null);
    if (db) { setPlaylists(await listPlaylists(db)); setCounts(await countByStatus(db)); }
  };
  const askDelete = (p: PlaylistInfo) =>
    Alert.alert('Borrar playlist', `¿Borrar "${p.name}"? Se perderán también sus coincidencias elegidas.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar', style: 'destructive',
        onPress: async () => {
          if (!db) return;
          await deletePlaylist(db, p.id);
          setPlaylists(await listPlaylists(db)); setCounts(await countByStatus(db));
          if (current?.playlistId === p.id) setCurrent(null);
        },
      },
    ]);

  /* ---------- Matching ---------- */
  const onMatch = async () => {
    if (!db || !current || matching) return;
    setMatching(true); setError(null); setMessage(null);
    signal.current = { aborted: false };
    try {
      const sum: QueueSummary = await runMatching(
        entries.map(e => e.track),
        makeQueueDeps(db, search),
        { signal: signal.current, onProgress: p => setProgress({ done: p.done, total: p.total, title: p.track.title }) },
      );
      await refresh(db, current.playlistId);
      const parts = [
        `${sum.auto} automáticas`, `${sum.review} a revisar`, `${sum.none} sin resultado`,
        sum.skipped ? `${sum.skipped} ya resueltas` : '', sum.errors ? `${sum.errors} errores` : '',
      ].filter(Boolean);
      setMessage(`${sum.aborted ? 'Cancelado. ' : ''}Matching: ${parts.join(' · ')}.`);
      if (sum.stoppedByErrors) setError('Se detuvo por errores seguidos (¿sin conexión o YouTube bloqueando?).');
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
      setDebugOut(JSON.stringify(r.slice(0, 3), null, 1));
    } catch (e) {
      setDebugOut(`Error: ${String(e)}`);
    }
  };

  /* ---------- Reproductor ---------- */
  const startAt = (trackId?: string, forceShuffle?: boolean) => {
    const b = buildQueue(entries);
    if (b.length === 0) return;
    const shuf = forceShuffle ?? shuffle;
    setShuffle(shuf); setBase(b);
    if (shuf) { setQueue(shuffleQueue(b, trackId)); setNowIdx(0); }
    else { setQueue(b); setNowIdx(trackId ? Math.max(0, b.findIndex(i => i.trackId === trackId)) : 0); }
    setPlaying(true);
  };
  const step = (dir: 1 | -1) => {
    if (nowIdx === null) return;
    const n = stepIndex(nowIdx, queue.length, dir);
    if (n === null) { if (dir === 1) { setNowIdx(null); setPlaying(false); } return; }
    setNowIdx(n); setPlaying(true);
  };
  const toggleShuffle = () => {
    if (nowIdx === null) { setShuffle(v => !v); return; }
    const cur = queue[nowIdx];
    if (!shuffle) { setQueue(shuffleQueue(base, cur.trackId)); setNowIdx(0); }
    else { setQueue(base); setNowIdx(Math.max(0, base.findIndex(i => i.trackId === cur.trackId))); }
    setShuffle(!shuffle);
  };
  const playSearchResult = (r: YtResult) => {
    const item: QueueItem = { trackId: `yt:${r.videoId}`, videoId: r.videoId, title: r.title, artists: r.artists };
    setShuffle(false); setBase([item]); setQueue([item]); setNowIdx(0); setPlaying(true);
  };
  const onPlayerError = () => {
    const cur = nowIdx !== null ? queue[nowIdx] : null;
    setError(`No se pudo reproducir "${cur?.title ?? ''}" (puede no permitir reproducción embebida). Pasando a la siguiente.`);
    step(1);
  };

  /* ---------- Datos derivados ---------- */
  const nowVideoId = nowIdx !== null ? queue[nowIdx]?.videoId : undefined;
  const nowTrackId = nowIdx !== null ? queue[nowIdx]?.trackId : undefined;
  const nOf = (st: string) => entries.filter(e => e.status === st).length;
  const ready = nOf('auto') + nOf('manual');
  const pending = nOf('pending');
  const none = nOf('none');
  const hasPlayable = entries.some(e => e.videoId);
  const currentInfo = current ? playlists.find(p => p.id === current.playlistId) : undefined;

  const visiblePlaylists = playlists.filter(p => {
    if (query.trim() && !p.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
    if (libFilter === 'complete') return p.total > 0 && p.resolved === p.total;
    if (libFilter === 'doubts') return p.pending > 0;
    return true;
  });
  const visibleEntries = entries.filter(e => trackFilter === 'all' || e.status === trackFilter);

  const notices = (
    <>
      {message && <View style={s.notice}><Text style={s.noticeText}>{message}</Text></View>}
      {error && <View style={[s.notice, { backgroundColor: colors.dangerBg }]}><Text style={[s.noticeText, { color: colors.danger }]}>{error}</Text></View>}
    </>
  );

  /* ---------- Vistas ---------- */
  const library = (
    <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
      <View style={s.topRow}>
        <IconBtn name="musical-notes" tone="dark" onPress={() => {}} disabled={false} />
        <Text style={type.small}>{playlists.length} {playlists.length === 1 ? 'playlist' : 'playlists'}</Text>
      </View>
      <Text style={type.h1}>Tu música,{'\n'}siempre a mano</Text>

      <View style={s.searchRow}>
        <View style={s.search}>
          <Icon name="search" size={18} color={colors.faint} />
          <TextInput
            style={s.searchInput} value={query} onChangeText={setQuery}
            placeholder="Buscar playlist…" placeholderTextColor={colors.faint} autoCorrect={false}
          />
        </View>
        <IconBtn name={showImport ? 'close' : 'add'} tone="accent" size={48} iconSize={22} onPress={() => setShowImport(v => !v)} />
      </View>

      {(showImport || playlists.length === 0) && (
        <View style={s.banner}>
          <View style={s.bannerTop}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={s.bannerKicker}>Spotify</Text>
              <Text style={s.bannerTitle}>Importa una playlist</Text>
              <Text style={s.bannerBody}>Pega el enlace de una playlist pública.</Text>
            </View>
            <Disc seed="importar" size={84} />
          </View>
          <TextInput
            style={s.bannerField} value={url} onChangeText={setUrl}
            placeholder="https://open.spotify.com/playlist/…" placeholderTextColor={colors.onDarkMuted}
            autoCapitalize="none" autoCorrect={false} keyboardType="url"
          />
          <Btn tone="light" label="Importar" onPress={onImport} busy={busy} disabled={!db || matching || !url.trim()} />
        </View>
      )}

      {notices}

      <View style={s.sectionHead}>
        <Text style={type.h2}>Tus playlists</Text>
        <Text style={type.small}>{visiblePlaylists.length} de {playlists.length}</Text>
      </View>
      <View style={s.chips}>
        <Chip label="Todas" selected={libFilter === 'all'} onPress={() => setLibFilter('all')} />
        <Chip label="Completas" selected={libFilter === 'complete'} onPress={() => setLibFilter('complete')} />
        <Chip label="Con dudosas" selected={libFilter === 'doubts'} onPress={() => setLibFilter('doubts')} />
      </View>

      {playlists.length > 0 && visiblePlaylists.length === 0 && <Text style={type.body}>Ninguna playlist coincide.</Text>}
      <View style={s.grid}>
        {visiblePlaylists.map(p => (
          <PlaylistCard key={p.id} info={p} width={cardW} onPress={() => openPlaylist(p)} onDelete={() => askDelete(p)} />
        ))}
      </View>

      <Btn tone="soft" label="Diagnóstico de YouTube Music" onPress={onDebug} />
      {debugOut && <Text style={s.mono}>{debugOut}</Text>}
    </ScrollView>
  );

  const detail = current && (
    <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
      <View style={s.detailBar}>
        <IconBtn name="chevron-back" onPress={closePlaylist} />
        <Text style={s.detailBarTitle}>Playlist</Text>
        <IconBtn name="trash-outline" onPress={() => currentInfo && askDelete(currentInfo)} disabled={!currentInfo} />
      </View>

      <View style={s.stage}><Disc seed={current.name} size={150} /></View>

      <View style={s.nameRow}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={s.detailName} numberOfLines={2}>{current.name}</Text>
          <Text style={type.small}>{entries.length} canciones · {pending} dudosas · {none} sin resultado</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.big}>{ready}<Text style={s.bigMuted}>/{entries.length}</Text></Text>
          <Text style={type.small}>listas</Text>
        </View>
      </View>

      <View style={s.chips}>
        <Chip tone="dark" label="Todas" selected={trackFilter === 'all'} onPress={() => setTrackFilter('all')} />
        <Chip tone="dark" label={`Dudosas${pending ? ` (${pending})` : ''}`} selected={trackFilter === 'pending'} onPress={() => setTrackFilter('pending')} />
        <Chip tone="dark" label="Sin resultado" selected={trackFilter === 'none'} onPress={() => setTrackFilter('none')} />
      </View>

      {matching ? (
        <View style={s.panel}>
          <Text style={type.small} numberOfLines={1}>
            {progress ? `Buscando ${progress.done}/${progress.total} · ${progress.title}` : 'Iniciando…'}
          </Text>
          <View style={s.bar}><View style={[s.barFill, { width: `${progress ? Math.round((progress.done / progress.total) * 100) : 0}%` }]} /></View>
          <Btn tone="soft" label="Cancelar" onPress={() => { signal.current.aborted = true; }} />
        </View>
      ) : (
        <View style={s.row}>
          <Btn flex tone="soft" icon="search" label="Buscar coincidencias" onPress={onMatch} disabled={busy} />
          {pending > 0 && <Btn flex tone="soft" icon="checkmark-done" label={`Revisar (${pending})`} onPress={() => goTab('review')} />}
        </View>
      )}

      {notices}

      <View style={{ gap: 8 }}>
        {visibleEntries.length === 0 && <Text style={type.body}>No hay canciones en este filtro.</Text>}
        {visibleEntries.map(e => {
          const v = chosen[e.track.id];
          return (
            <TrackRow
              key={e.position} index={e.position + 1} title={e.track.title} artists={e.track.artists.join(', ')}
              videoCaption={v ? `↳ ${v.title} — ${v.artists.join(', ')}` : undefined}
              status={e.status} isNow={e.track.id === nowTrackId} playable={!!v}
              onPress={() => startAt(e.track.id)} onSearch={() => setManualFor(e.track)}
            />
          );
        })}
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.safe}>
        {tab === 'review' && db
          ? <ReviewScreen db={db} search={search} onChanged={() => countByStatus(db).then(setCounts)} />
          : tab === 'search' && db
            ? <SearchScreen db={db} search={search} nowVideoId={nowVideoId} onPlay={playSearchResult} />
            : (current ? detail : library)}

        {tab === 'library' && current && hasPlayable && (
          <View style={s.actionBar}>
            <Btn flex label="Reproducir" icon="play" onPress={() => startAt(undefined, false)} />
            <IconBtn name="shuffle" tone="dark" size={52} onPress={() => startAt(undefined, true)} />
          </View>
        )}

        {nowIdx !== null && queue[nowIdx] && (
          <PlayerDock
            item={queue[nowIdx]} playing={playing} shuffle={shuffle}
            onToggle={() => setPlaying(p => !p)} onNext={() => step(1)} onPrev={() => step(-1)}
            onClose={() => { setNowIdx(null); setPlaying(false); }}
            onToggleShuffle={toggleShuffle} onEnded={() => step(1)} onError={onPlayerError} onPlayingChange={setPlaying}
          />
        )}

        {manualFor && db && current && (
          <ManualSearch
            db={db} track={manualFor} search={search}
            currentVideoId={entries.find(e => e.track.id === manualFor.id)?.videoId}
            onClose={() => setManualFor(null)}
            onPicked={async v => {
              setManualFor(null);
              setMessage(`"${manualFor.title}" ahora usa: ${v.title} — ${v.artists.join(', ')}.`);
              await refresh(db, current.playlistId);
              setPlaylists(await listPlaylists(db));
            }}
          />
        )}

        <TabBar tab={tab} onChange={goTab} pending={counts.pending ?? 0} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 24, paddingBottom: 28, gap: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  /* buscador */
  searchRow: { flexDirection: 'row', gap: 10 },
  search: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 14,
    backgroundColor: colors.chip, borderRadius: radius.md,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  /* banner de importación */
  banner: { backgroundColor: colors.dark, borderRadius: radius.xl, padding: 20, gap: 14 },
  bannerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bannerKicker: { color: colors.gold, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  bannerTitle: { color: colors.onDark, fontSize: 22, lineHeight: 26, fontWeight: '800', letterSpacing: -0.5 },
  bannerBody: { color: colors.onDarkMuted, fontSize: 13 },
  bannerField: { backgroundColor: colors.onDarkLine, color: colors.onDark, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14 },
  /* avisos */
  notice: { backgroundColor: colors.chip, borderRadius: radius.md, padding: 14 },
  noticeText: { color: colors.text, fontSize: 13, lineHeight: 19 },
  /* biblioteca */
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  mono: { color: colors.muted, fontSize: 11, fontFamily: fonts.mono },
  /* detalle */
  detailBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailBarTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  stage: { backgroundColor: colors.chip, borderRadius: radius.xl, height: 210, alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  detailName: { color: colors.text, fontSize: 24, lineHeight: 28, fontWeight: '800', letterSpacing: -0.6 },
  big: { color: colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.6 },
  bigMuted: { color: colors.faint, fontSize: 16, fontWeight: '700' },
  panel: { gap: 10, backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.line },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.chip, overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: colors.accent },
  actionBar: { flexDirection: 'row', gap: 10, paddingHorizontal: 24, paddingTop: 10 },
});
