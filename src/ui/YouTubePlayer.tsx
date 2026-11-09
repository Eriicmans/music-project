import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import YoutubePlayer, { YoutubeIframeRef } from 'react-native-youtube-iframe';

export interface PlayerProps {
  videoId: string;
  playing: boolean;
  onEnded: () => void;
  onError: (reason: string) => void;
  onPlayingChange: (playing: boolean) => void;
}

/** Control del motor desde fuera (progreso y saltos). */
export interface PlayerHandle {
  getCurrentTime: () => Promise<number>;
  getDuration: () => Promise<number>;
  seekTo: (seconds: number) => void;
}

/**
 * ÚNICO archivo que conoce el motor de reproducción (iframe oficial de YouTube).
 * El vídeo no se ve: se monta en un contenedor de 1×1 px recortado (se mantiene
 * "en pantalla" porque iOS pausa los WebView ocultos del todo).
 * Para cambiar a otra vía basta con reescribir este componente con las mismas props y handle.
 */
export const YouTubePlayer = forwardRef<PlayerHandle, PlayerProps>(function YouTubePlayer(
  { videoId, playing, onEnded, onError, onPlayingChange }, ref,
) {
  const inner = useRef<YoutubeIframeRef>(null);
  useImperativeHandle(ref, () => ({
    getCurrentTime: async () => (await inner.current?.getCurrentTime()) ?? 0,
    getDuration: async () => (await inner.current?.getDuration()) ?? 0,
    seekTo: (seconds: number) => { inner.current?.seekTo(seconds, true); },
  }), []);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, bottom: 0, width: 1, height: 1, overflow: 'hidden', opacity: 0.01 }}>
      <YoutubePlayer
        ref={inner}
        width={240}
        height={135}
        videoId={videoId}
        play={playing}
        onChangeState={(state: string) => {
          if (state === 'ended') onEnded();
          else if (state === 'playing') onPlayingChange(true);
          else if (state === 'paused') onPlayingChange(false);
        }}
        onError={(reason: string) => onError(reason)}
      />
    </View>
  );
});
