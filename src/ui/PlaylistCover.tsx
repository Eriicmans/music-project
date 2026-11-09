import React from 'react';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Cover } from './Cover';
import { tintFor } from './theme';

/**
 * Portada de playlist: mosaico 2×2 con las miniaturas de sus canciones (4 o más),
 * la miniatura de la primera (1 a 3), o un degradado con su inicial si aún no hay ninguna.
 */
export function PlaylistCover({ name, videoIds, size, radius = 20 }: { name: string; videoIds: string[]; size: number; radius?: number }) {
  const box = { width: size, height: size, borderRadius: radius, overflow: 'hidden' as const };

  if (videoIds.length >= 4) {
    const h = size / 2;
    return (
      <View style={[box, { flexDirection: 'row', flexWrap: 'wrap' }]}>
        {videoIds.slice(0, 4).map(id => <Cover key={id} videoId={id} size={h} radius={0} seed={name} />)}
      </View>
    );
  }
  if (videoIds.length > 0) {
    return <View style={box}><Cover videoId={videoIds[0]} size={size} radius={0} seed={name} /></View>;
  }

  const [a, b] = tintFor(name);
  const initial = (name.match(/[0-9A-Za-zÀ-ÿ]/)?.[0] ?? '♪').toUpperCase();
  return (
    <LinearGradient colors={[a, b]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[box, { alignItems: 'center', justifyContent: 'center' }]}>
      <View style={{ position: 'absolute', width: size * 0.9, height: size * 0.9, borderRadius: size * 0.45, right: -size * 0.3, top: -size * 0.3, backgroundColor: 'rgba(255,255,255,0.12)' }} />
      <View style={{ position: 'absolute', width: size * 0.6, height: size * 0.6, borderRadius: size * 0.3, left: -size * 0.2, bottom: -size * 0.2, backgroundColor: 'rgba(0,0,0,0.14)' }} />
      <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: size * 0.46, fontWeight: '900' }}>{initial}</Text>
    </LinearGradient>
  );
}
