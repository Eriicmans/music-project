import React, { useState } from 'react';
import { Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { exportLibrary, importLibrary, parseBackup } from '../db/backup';
import { Db } from '../db/database';
import { Btn } from './kit';
import { colors, fonts, radius, type } from './theme';

/**
 * Copia de seguridad sin dependencias extra: "Exportar" abre la hoja de compartir del
 * sistema con la copia en texto (guárdala en Notas, mándatela por correo…); "Restaurar"
 * admite ese mismo texto pegado. Restaurar solo añade, nunca borra ni pisa.
 */
export function BackupPanel({ db, onRestored }: { db: Db; onRestored: () => void }) {
  const [restoring, setRestoring] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);

  const onExport = async () => {
    setBusy(true); setNote(null);
    try {
      const data = await exportLibrary(db);
      if (data.playlists.length === 0) { setNote({ text: 'No hay playlists que guardar todavía.' }); return; }
      await Share.share({ title: 'Copia de Music Project', message: JSON.stringify(data) });
    } catch (e) {
      setNote({ text: `No se pudo exportar: ${String(e)}`, error: true });
    } finally {
      setBusy(false);
    }
  };

  const onRestore = async () => {
    setBusy(true); setNote(null);
    try {
      const r = await importLibrary(db, parseBackup(text));
      setNote({
        text: `Restauradas ${r.playlists} playlists (${r.tracks} canciones nuevas, ${r.matches} vídeos elegidos)` +
          (r.skippedPlaylists ? `; ${r.skippedPlaylists} ya existían y se omitieron.` : '.'),
      });
      setText(''); setRestoring(false);
      onRestored();
    } catch (e) {
      setNote({ text: e instanceof Error ? e.message : String(e), error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.box}>
      <Text style={type.h2}>Copia de seguridad</Text>
      <Text style={type.small}>Tus playlists viven solo en este iPhone: si desinstalas la app se pierden. Guarda una copia de vez en cuando.</Text>
      <View style={s.row}>
        <Btn flex tone="soft" icon="share-outline" label="Exportar" onPress={onExport} busy={busy && !restoring} />
        <Btn flex tone="soft" icon="download-outline" label={restoring ? 'Cancelar' : 'Restaurar'} onPress={() => { setRestoring(v => !v); setNote(null); }} disabled={busy} />
      </View>
      {restoring && (
        <>
          <TextInput
            style={s.field} value={text} onChangeText={setText} multiline
            placeholder="Pega aquí el texto de la copia…" placeholderTextColor={colors.faint}
            autoCapitalize="none" autoCorrect={false}
          />
          <Btn label="Restaurar copia" onPress={onRestore} busy={busy} disabled={!text.trim()} />
        </>
      )}
      {note && (
        <View style={[s.note, note.error && { backgroundColor: colors.dangerBg }]}>
          <Text style={[s.noteText, note.error && { color: colors.danger }]}>{note.text}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  box: { gap: 10, backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.line },
  row: { flexDirection: 'row', gap: 10 },
  field: {
    minHeight: 90, maxHeight: 160, backgroundColor: colors.chip, borderRadius: radius.sm, padding: 12,
    color: colors.text, fontSize: 11, fontFamily: fonts.mono, textAlignVertical: 'top',
  },
  note: { backgroundColor: colors.chip, borderRadius: radius.md, padding: 12 },
  noteText: { color: colors.text, fontSize: 13, lineHeight: 19 },
});
