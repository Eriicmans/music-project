import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { runMatching, QueueSummary } from './src/core/matching/matchQueue';
import { SearchFn } from './src/core/matching/matchTrack';
import { Track } from './src/models/Track';
import { buildQueue, nextIndex, nextRepeat, QueueItem, RepeatMode, shuffleQueue } from './src/core/player/queue';
import { Db } from './src/db/database';
import { makeQueueDeps } from './src/db/matchingAdapter';
import { openDb } from './src/db/openDb';
import {
  ChosenVideo, countByStatus, deletePlaylist, getChosenVideos, getPlaylistEntries, listPlaylists, PlaylistEntry, PlaylistInfo,
  getPlaylistCovers, removeTrackFromPlaylist, renamePlaylist,
} from './src/db/repository';
import { ImportError } from './src/importers/errors';
import { importSpotifyPlaylist } from './src/importers/spotify/importPlaylist';
import { searchYtMusic, YtResult } from './src/providers/youtubeMusic/search';
import { BackupPanel } from './src/ui/BackupPanel';
import { PlaylistCard, PlaylistHero, TrackRow } from './src/ui/cards';
import { LinearGradient } from 'expo-linear-gradient';
import { Btn, Chip, Disc, GlassBtn, Icon, IconBtn } from './src/ui/kit';
import { PlaylistCover } from './src/ui/PlaylistCover';
import { ManualSearch } from './src/ui/ManualSearch';
import { SearchScreen } from './src/ui/SearchScreen';
import { MiniPlayer } from './src/ui/MiniPlayer';
import { NowPlaying } from './src/ui/NowPlaying';
import { usePlayerProgress } from './src/ui/usePlayerProgress';
import { PlayerHandle, YouTubePlayer } from './src/ui/YouTubePlayer';
import { ReviewScreen } from './src/ui/ReviewScreen';
import { Tab, TabBar } from './src/ui/TabBar';
import { colors, fonts, greeting, radius, tintFor, type } from './src/ui/theme';

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
  const [covers, setCovers] = useState<Record<string, string[]>>({});
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
  const [repeat, setRepeat] = useState<RepeatMode>('off');
  const [expanded, setExpanded] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [engineLog, setEngineLog] = useState<string[]>([]);
  const log = useCallback((m: string) => setEngineLog(l => [...l.slice(-11), `${new Date().toLocaleTimeString()} ${m}`]), []);
  const [awaitingTap, setAwaitingTap] = useState(false);
  const [source, setSource] = useState('Playlist');
  const engine = useRef<PlayerHandle>(null);
  const [manualFor, setManualFor] = useState<Track | null>(null);
  const [debugOut, setDebugOut] = useState<string | null>(null);
  const signal = useRef({ aborted: false });

  /** Recarga la lista de playlists y las miniaturas de sus portadas. */
  const loadLibrary = useCallback(async (d: Db) => {
    setPlaylists(await listPlaylists(d));
    setCovers(await getPlaylistCovers(d));
  }, []);

  useEffect(() => {
    openDb()
      .then(async d => { setDb(d); setCounts(await countByStatus(d)); await loadLibrary(d); })
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
      await loadLibrary(db);
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
      await loadLibrary(db);
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
    if (db) { await loadLibrary(db); setCounts(await countByStatus(db)); }
  };
  const askDelete = (p: PlaylistInfo) =>
    Alert.alert('Borrar playlist', `¿Borrar "${p.name}"? Se perderán también sus coincidencias elegidas.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar', style: 'destructive',
        onPress: async () => {
          if (!db) return;
          await deletePlaylist(db, p.id);
          await loadLibrary(db); setCounts(await countByStatus(db));
          if (current?.playlistId === p.id) setCurrent(null);
        },
      },
    ]);

  /** Pulsación larga en una canción: quitarla de la playlist (no afecta a Spotify). */
  const askRemove = (e: PlaylistEntry) => {
    if (!db || !current) return;
    Alert.alert('Quitar canción', `¿Quitar "${e.track.title}" de "${current.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar', style: 'destructive',
        onPress: async () => {
          await removeTrackFromPlaylist(db, current.playlistId, e.position);
          await refresh(db, current.playlistId);
          await loadLibrary(db);
        },
      },
    ]);
  };

  /** Renombrar (Alert.prompt solo existe en iOS). Si reimportas desde Spotify, el nombre vuelve al original. */
  const askRename = () => {
    if (!db || !current || Platform.OS !== 'ios') return;
    Alert.prompt('Renombrar playlist', undefined, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Guardar',
        onPress: async (value?: string) => {
          const name = value?.trim();
          if (!name) return;
          await renamePlaylist(db, current.playlistId, name);
          setCurrent({ playlistId: current.playlistId, name });
          await loadLibrary(db);
        },
      },
    ], 'plain-text', current.name);
  };

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
    setSource(current?.name ?? 'Playlist');
    setShuffle(shuf); setBase(b);
    if (shuf) { setQueue(shuffleQueue(b, trackId)); setNowIdx(0); }
    else { setQueue(b); setNowIdx(trackId ? Math.max(0, b.findIndex(i => i.trackId === trackId)) : 0); }
    setPlaying(true);
  };
  const restart = () => {
    engine.current?.seekTo(0);
    setPlaying(false);
    setTimeout(() => setPlaying(true), 60);
  };
  const step = (dir: 1 | -1) => {
    if (nowIdx === null) return;
    const n = nextIndex(nowIdx, queue.length, dir, repeat);
    if (n === null) { if (dir === 1) { setNowIdx(null); setPlaying(false); setExpanded(false); } return; }
    if (n === nowIdx) { restart(); return; }
    setNowIdx(n); setPlaying(true);
  };
  const onEnded = () => { if (repeat === 'one') restart(); else step(1); };
  /** Como en las apps de streaming: pasados 3 s, "anterior" vuelve al inicio de la canción. */
  const onPrev = async () => {
    const t = await engine.current?.getCurrentTime().catch(() => 0);
    if ((t ?? 0) > 3) { engine.current?.seekTo(0); return; }
    step(-1);
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
    setSource('Búsqueda'); setShuffle(false); setBase([item]); setQueue([item]); setNowIdx(0); setPlaying(true);
  };
  const onPlayerError = () => {
    const cur = nowIdx !== null ? queue[nowIdx] : null;
    setError(`No se pudo reproducir "${cur?.title ?? ''}" (puede no permitir reproducción embebida). Pasando a la siguiente.`);
    step(1);
  };

  /* iOS: la primera reproducción necesita un toque dentro del reproductor (que va invisible sobre el botón de play). Si en 1,5 s no ha empezado solo, se avisa. */
  const curVideo = nowIdx !== null ? queue[nowIdx]?.videoId : undefined;
  useEffect(() => {
    if (!curVideo || !playing || unlocked) return;
    const t = setTimeout(() => { setAwaitingTap(true); setExpanded(false); }, 1500);
    return () => clearTimeout(t);
  }, [curVideo, playing, unlocked]);
  const onPlayingChange = (p: boolean) => {
    setPlaying(p);
    if (p) { setUnlocked(true); setAwaitingTap(false); }
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
  const totalReady = playlists.reduce((n, p) => n + p.resolved, 0);
  const hero = !query.trim() && libFilter === 'all' ? visiblePlaylists[0] : undefined;
  const gridList = hero ? visiblePlaylists.slice(1) : visiblePlaylists;

  const library = (
    <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
      <View style={s.topRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={type.kicker}>{greeting().toUpperCase()}</Text>
          <Text style={type.display}>Tu música</Text>
        </View>
        <IconBtn name={showImport ? 'close' : 'add'} tone="accent" size={52} iconSize={24} onPress={() => setShowImport(v => !v)} />
      </View>
      <Text style={type.body}>
        {playlists.length} {playlists.length === 1 ? 'playlist' : 'playlists'} · {totalReady} canciones listas para sonar
      </Text>

      <View style={s.search}>
        <Icon name="search" size={18} color={colors.faint} />
        <TextInput
          style={s.searchInput} value={query} onChangeText={setQuery}
          placeholder="Buscar playlist…" placeholderTextColor={colors.faint} autoCorrect={false}
        />
      </View>

      {(showImport || playlists.length === 0) && (
        <LinearGradient colors={['#C0562F', '#6E2A14']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.banner}>
          <View style={s.bannerTop}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={s.bannerKicker}>SPOTIFY</Text>
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
        </LinearGradient>
      )}

      {notices}

      <View style={s.chips}>
        <Chip label="Todas" selected={libFilter === 'all'} onPress={() => setLibFilter('all')} />
        <Chip label="Completas" selected={libFilter === 'complete'} onPress={() => setLibFilter('complete')} />
        <Chip label="Con dudosas" selected={libFilter === 'doubts'} onPress={() => setLibFilter('doubts')} />
      </View>

      {playlists.length > 0 && visiblePlaylists.length === 0 && <Text style={type.body}>Ninguna playlist coincide.</Text>}
      {hero && <PlaylistHero info={hero} videoIds={covers[hero.id] ?? []} onPress={() => openPlaylist(hero)} />}
      {gridList.length > 0 && (
        <View style={s.sectionHead}>
          <Text style={type.h2}>{hero ? 'Más playlists' : 'Tus playlists'}</Text>
          <Text style={type.small}>{visiblePlaylists.length} de {playlists.length}</Text>
        </View>
      )}
      <View style={s.grid}>
        {gridList.map((p, i) => (
          <PlaylistCard
            key={p.id} info={p} videoIds={covers[p.id] ?? []} width={cardW} index={i}
            onPress={() => openPlaylist(p)} onDelete={() => askDelete(p)}
          />
        ))}
      </View>

      {db && (
        <BackupPanel
          db={db}
          onRestored={async () => { await loadLibrary(db); setCounts(await countByStatus(db)); }}
        />
      )}

      <Btn tone="soft" label="Diagnóstico de YouTube Music" onPress={onDebug} />
      {debugOut && <Text style={s.mono}>{debugOut}</Text>}
      {engineLog.length > 0 && <Text style={s.mono}>{'Reproductor:\n' + engineLog.join('\n')}</Text>}
    </ScrollView>
  );

  const detailCovers = Array.from(new Set(entries.map(e => e.videoId).filter((v): v is string => !!v))).slice(0, 4);
  const detailHeader = current && (
    <View style={s.listHeader}>
      <LinearGradient colors={tintFor(current.name)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.heroBox}>
        <View style={s.heroBlob} />
        <View style={s.detailBar}>
          <GlassBtn name="chevron-back" onPress={closePlaylist} />
          <Text style={s.heroKicker}>PLAYLIST</Text>
          <GlassBtn name="trash-outline" onPress={() => currentInfo && askDelete(currentInfo)} disabled={!currentInfo} />
        </View>

        <View style={s.heroCover}>
          <PlaylistCover name={current.name} videoIds={detailCovers} size={176} radius={radius.lg} />
        </View>

        <Pressable onPress={askRename} disabled={Platform.OS !== 'ios'} style={s.nameTap}>
          <Text style={[s.detailName, { flexShrink: 1 }]} numberOfLines={2}>{current.name}</Text>
          {Platform.OS === 'ios' && <Icon name="create-outline" size={16} color="rgba(255,255,255,0.7)" />}
        </Pressable>
        <Text style={s.heroStats}>
          {entries.length} canciones · {ready} listas · {pending} dudosas · {none} sin resultado
        </Text>

        <View style={s.row}>
          <Btn flex tone="light" icon="play" label="Reproducir" onPress={() => startAt(undefined, false)} disabled={!hasPlayable} />
          <GlassBtn name="shuffle" size={52} onPress={() => startAt(undefined, true)} disabled={!hasPlayable} />
        </View>
      </LinearGradient>

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

      {entries.length > 0 && <Text style={type.small}>Mantén pulsada una canción para quitarla de la playlist.</Text>}

    </View>
  );

  /** FlatList (virtualizada): solo se pintan las filas visibles, importa con listas largas y miniaturas. */
  const detail = current && (
    <FlatList
      data={visibleEntries}
      extraData={[nowTrackId, chosen]}
      keyExtractor={e => String(e.position)}
      contentContainerStyle={s.listContainer}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={12}
      windowSize={9}
      ListHeaderComponent={detailHeader ?? undefined}
      ListEmptyComponent={<Text style={type.body}>No hay canciones en este filtro.</Text>}
      ItemSeparatorComponent={RowGap}
      renderItem={({ item: e }: { item: PlaylistEntry }) => {
        const v = chosen[e.track.id];
        return (
          <TrackRow
            index={e.position + 1} title={e.track.title} artists={e.track.artists.join(', ')}
            videoId={e.videoId ?? undefined}
            videoCaption={v ? `↳ ${v.title} — ${v.artists.join(', ')}` : undefined}
            status={e.status} isNow={e.track.id === nowTrackId} playable={!!v}
            onPress={() => startAt(e.track.id)} onSearch={() => setManualFor(e.track)} onLongPress={() => askRemove(e)}
          />
        );
      }}
    />
  );

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }}>
      <SafeAreaView style={s.safe}>
        {tab === 'review' && db
          ? <ReviewScreen db={db} search={search} onChanged={() => countByStatus(db).then(setCounts)} />
          : tab === 'search' && db
            ? <SearchScreen db={db} search={search} nowVideoId={nowVideoId} onPlay={playSearchResult} />
            : (current ? detail : library)}

        {nowIdx !== null && queue[nowIdx] && (
          <>
            <MiniPlayerWithProgress
              item={queue[nowIdx]} playing={playing} engine={engine} awaitingTap={awaitingTap}
              player={
                <YouTubePlayer
                  ref={engine} videoId={queue[nowIdx].videoId} playing={playing} catchTap={!unlocked} onLog={log}
                  onEnded={onEnded} onError={onPlayerError} onPlayingChange={onPlayingChange}
                />
              }
              onOpen={() => { if (unlocked && !awaitingTap) setExpanded(true); }}
              onToggle={() => setPlaying(p => !p)} onNext={() => step(1)}
            />
          </>
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
              await loadLibrary(db);
            }}
          />
        )}

        <TabBar tab={tab} onChange={goTab} pending={counts.pending ?? 0} />
      </SafeAreaView>

        {expanded && !awaitingTap && nowIdx !== null && queue[nowIdx] && (
          <NowPlaying
            item={queue[nowIdx]} source={source} playing={playing} shuffle={shuffle} repeat={repeat} engine={engine}
            onClose={() => setExpanded(false)} onToggle={() => setPlaying(p => !p)}
            onNext={() => step(1)} onPrev={onPrev}
            onToggleShuffle={toggleShuffle} onCycleRepeat={() => setRepeat(nextRepeat)}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const RowGap = () => <View style={{ height: 8 }} />;

/** Mini-reproductor con su propio sondeo de progreso (así App no se redibuja cada 0,5 s). */
function MiniPlayerWithProgress({ item, playing, engine, awaitingTap, player, onOpen, onToggle, onNext }: {
  item: QueueItem; playing: boolean; engine: React.RefObject<PlayerHandle | null>; awaitingTap: boolean; player: React.ReactNode;
  onOpen: () => void; onToggle: () => void; onNext: () => void;
}) {
  const { position, duration } = usePlayerProgress(engine, playing, item.videoId);
  return (
    <MiniPlayer
      item={item} playing={playing} progress={duration > 0 ? position / duration : 0}
      awaitingTap={awaitingTap} engine={player}
      onOpen={onOpen} onToggle={onToggle} onNext={onNext}
    />
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 24, paddingBottom: 28, gap: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  row: { flexDirection: 'row', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  /* buscador */
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 14,
    backgroundColor: colors.chip, borderRadius: radius.md,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  /* banner de importación */
  banner: { borderRadius: radius.xl, padding: 20, gap: 14, overflow: 'hidden' },
  bannerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bannerKicker: { color: '#FFE2B8', fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  bannerTitle: { color: colors.onDark, fontSize: 24, lineHeight: 28, fontWeight: '900', letterSpacing: -0.6 },
  bannerBody: { color: colors.onDarkMuted, fontSize: 13 },
  bannerField: { backgroundColor: 'rgba(0,0,0,0.22)', color: colors.onDark, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14 },
  /* avisos */
  notice: { backgroundColor: colors.chip, borderRadius: radius.md, padding: 14 },
  noticeText: { color: colors.text, fontSize: 13, lineHeight: 19 },
  /* biblioteca */
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  mono: { color: colors.muted, fontSize: 11, fontFamily: fonts.mono },
  /* cabecera de playlist */
  listContainer: { padding: 24, paddingBottom: 28 },
  listHeader: { gap: 16, marginBottom: 16 },
  heroBox: { borderRadius: radius.xl, padding: 16, gap: 14, alignItems: 'stretch', overflow: 'hidden' },
  heroBlob: { position: 'absolute', width: 280, height: 280, borderRadius: 140, right: -90, top: -110, backgroundColor: 'rgba(255,255,255,0.12)' },
  detailBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroKicker: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  heroCover: {
    alignSelf: 'center', borderRadius: radius.lg,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 12,
  },
  nameTap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  detailName: { color: '#FFFFFF', fontSize: 28, lineHeight: 32, fontWeight: '900', letterSpacing: -0.8, textAlign: 'center' },
  heroStats: { color: 'rgba(255,255,255,0.8)', fontSize: 12, textAlign: 'center' },
  panel: { gap: 10, backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.line },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.chip, overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: colors.accent },
});