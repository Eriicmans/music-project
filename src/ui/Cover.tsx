import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { thumbnailUrl } from '../core/player/format';
import { Disc } from './kit';
import { colors } from './theme';

/** Portada cuadrada a partir de la miniatura de YouTube; si falla, un disco. */
export function Cover({ videoId, size, radius = 12, seed }: { videoId: string; size: number; radius?: number; seed: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [videoId]);
  if (failed) {
    return (
      <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' }}>
        <Disc seed={seed} size={size * 0.78} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri: thumbnailUrl(videoId) }} resizeMode="cover" onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: radius, backgroundColor: colors.chip }}
    />
  );
}
