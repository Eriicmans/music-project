import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { openDb } from './src/db/openDb';
import { SCHEMA_VERSION } from './src/db/migrations';
import { countByStatus } from './src/db/repository';

export default function App() {
  const [dbState, setDbState] = useState('Abriendo base de datos…');
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    openDb()
      .then(async db => {
        setCounts(await countByStatus(db));
        setDbState(`Base de datos lista · esquema v${SCHEMA_VERSION}`);
      })
      .catch(e => setDbState(`Error de base de datos: ${String(e)}`));
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>PROYECTO PRIVADO · V0.3</Text>
        <Text style={styles.title}>Tu música, bien identificada.</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Persistencia local</Text>
          <Text style={styles.status}>{dbState}</Text>
          <Text style={styles.body}>
            Coincidencias guardadas: auto {counts.auto ?? 0} · revisar {counts.pending ?? 0} ·
            manual {counts.manual ?? 0} · sin resultado {counts.none ?? 0}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B0D12' },
  container: { padding: 24, paddingTop: 48, gap: 18 },
  eyebrow: { color: '#8D9AAF', fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  title: { color: '#FFFFFF', fontSize: 34, lineHeight: 40, fontWeight: '800' },
  card: { backgroundColor: '#171C26', borderRadius: 18, padding: 18, gap: 10 },
  cardTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  body: { color: '#B6C0D0', fontSize: 14, lineHeight: 21 },
  status: { color: '#70D6A4', fontSize: 13, fontWeight: '700' },
});
