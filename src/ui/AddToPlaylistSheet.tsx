import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Db } from '../db/database';
import { addYoutubeTrackToPlaylist, createPlaylist, listPlaylists, PlaylistInfo, YoutubeTrackInput } from '../db/repository';
import { Btn, Disc, Icon, IconBtn } from './kit';
import { colors, radius, type } from './theme';

interface Props {
  db: Db;
  track: YoutubeTrackInput;
  onClose: () => void;
  /** `added` es false si la canción ya estaba en esa playlist. */
  onDone: (playlistName: string, added: boolean) => void;
}

/** Hoja para elegir a qué playlist añadir una canción (o crear una nueva). */
export function AddToPlaylistSheet({ db, track, onClose, onDone }: Props) {
  const [playlists, setPlaylists] = useState<PlaylistInfo[] | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { listPlaylists(db).then(setPlaylists).catch(e => setError(String(e))); }, [db]);

  const add = async (playlistId: string, playlistName: string) => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const r = await addYoutubeTrackToPlaylist(db, playlistId, track);
      onDone(playlistName, r.added);
    } catch (e) {
      setError(`No se pudo añadir: ${String(e)}`);
      setBusy(false);
    }
  };

  const addToNew = async () => {
    if (busy || !name.trim()) return;
    setBusy(true); setError(null);
    try {
      const id = await createPlaylist(db, name);
      const r = await addYoutubeTrackToPlaylist(db, id, track);
      onDone(name.trim(), r.added);
    } catch (e) {
      setError(`No se pudo crear la playlist: ${String(e)}`);
      setBusy(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.root}>
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <Text style={type.small}>Añadir a playlist</Text>
              <Text style={type.h2} numberOfLines={2}>{track.title}</Text>
              <Text style={type.small} numberOfLines={1}>{track.artists.join(', ')}</Text>
            </View>
            <IconBtn name="close" onPress={onClose} />
          </View>

          <View style={s.newBox}>
            <Text style={s.newLabel}>NUEVA PLAYLIST</Text>
            <View style={s.newRow}>
              <TextInput
                style={s.input} value={name} onChangeText={setName} placeholder="Nombre…"
                placeholderTextColor={colors.onDarkMuted} returnKeyType="done" onSubmitEditing={addToNew}
              />
              <Btn tone="light" label="Crear" onPress={addToNew} disabled={busy || !name.trim()} />
            </View>
          </View>

          {error && <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View>}
          {playlists === null && <ActivityIndicator color={colors.accent} />}
          {playlists && playlists.length === 0 && (
            <Text style={type.body}>Aún no tienes playlists. Crea la primera arriba.</Text>
          )}

          {playlists?.map(p => (
            <Pressable key={p.id} disabled={busy} onPress={() => add(p.id, p.name)} style={({ pressed }) => [s.item, pressed && { opacity: 0.8 }]}>
              <Disc seed={p.name} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={s.itemName} numberOfLines={1}>{p.name}</Text>
                <Text style={type.small}>{p.total} canciones</Text>
              </View>
              <Icon name="add-circle" size={26} color={colors.accent} />
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 24, gap: 12, paddingBottom: 40 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 6 },
  newBox: { backgroundColor: colors.dark, borderRadius: radius.xl, padding: 16, gap: 10 },
  newLabel: { color: colors.onDarkMuted, fontSize: 10, letterSpacing: 2, fontWeight: '800' },
  newRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: { flex: 1, backgroundColor: colors.onDarkLine, color: colors.onDark, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 },
  errorBox: { backgroundColor: colors.dangerBg, borderRadius: radius.md, padding: 14 },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
  },
  itemName: { color: colors.text, fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
});
