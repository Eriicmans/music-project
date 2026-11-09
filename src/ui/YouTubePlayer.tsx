import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';
import YoutubePlayer, { YoutubeIframeRef } from 'react-native-youtube-iframe';

export interface PlayerProps {
  videoId: string;
  playing: boolean;
  onEnded: () => void;
  onError: (reason: string) => void;
  onPlayingChange: (playing: boolean) => void;
  /**
   * iOS exige un toque del usuario DENTRO del reproductor para la primera reproducción.
   * Con `catchTap` el reproductor (invisible) se coloca encima de su anfitrión (el botón de
   * play del mini-reproductor, de `hostSize` px) para que ese toque caiga en él. Su tamaño y
   * posición NO cambian nunca (cambiarlos hacía que iOS pausara la reproducción); solo se
   * activa/desactiva que reciba toques. Debe renderizarse dentro de una vista con `position: relative`.
   */
  catchTap?: boolean;
  hostSize?: number;
  /** Mensajes de diagnóstico (estados del reproductor y errores). */
  onLog?: (message: string) => void;
}

/** Control del motor desde fuera (progreso y saltos). */
export interface PlayerHandle {
  getCurrentTime: () => Promise<number>;
  getDuration: () => Promise<number>;
  seekTo: (seconds: number) => void;
}

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const W = 240;
const H = 135;

/**
 * ÚNICO archivo que conoce el motor de reproducción (iframe oficial de YouTube).
 * El vídeo nunca se ve: va recortado al tamaño del botón de play y a opacidad casi nula.
 * Para cambiar a otra vía basta con reescribir este componente con las mismas props y handle.
 */
export const YouTubePlayer = forwardRef<PlayerHandle, PlayerProps>(function YouTubePlayer(
  { videoId, playing, onEnded, onError, onPlayingChange, catchTap = false, hostSize = 38, onLog }, ref,
) {
  const inner = useRef<YoutubeIframeRef>(null);
  useImperativeHandle(ref, () => ({
    getCurrentTime: async () => (await inner.current?.getCurrentTime()) ?? 0,
    getDuration: async () => (await inner.current?.getDuration()) ?? 0,
    seekTo: (seconds: number) => { inner.current?.seekTo(seconds, true); },
  }), []);

  /**
   * Pausa fiable: en iOS a veces el iframe ignora la orden de pausar (la canción sigue sonando).
   * Tras pausar se comprueba que el tiempo no avanza; si avanza, se reenvía la orden
   * (play→pause) hasta 3 veces. Mientras se reintenta se ignoran los estados del iframe.
   */
  const [force, setForce] = useState<boolean | null>(null);
  const forcing = useRef(false);
  useEffect(() => {
    if (playing) return;
    let cancelled = false;
    (async () => {
      await wait(500);
      for (let attempt = 1; attempt <= 3 && !cancelled; attempt++) {
        const a = (await inner.current?.getCurrentTime().catch(() => 0)) ?? 0;
        await wait(600);
        const b = (await inner.current?.getCurrentTime().catch(() => 0)) ?? 0;
        if (cancelled || b - a < 0.3) break;
        onLog?.(`la pausa no surtió efecto; reintento ${attempt}`);
        forcing.current = true;
        setForce(true); await wait(150);
        setForce(false); await wait(700);
      }
      forcing.current = false;
      if (!cancelled) setForce(null);
    })();
    return () => { cancelled = true; forcing.current = false; setForce(null); };
  }, [playing, videoId, onLog]);

  return (
    <View
      pointerEvents={catchTap ? 'auto' : 'none'}
      style={{
        position: 'absolute', left: 0, top: 0, width: hostSize, height: hostSize, borderRadius: hostSize / 2,
        overflow: 'hidden', opacity: 0.05, zIndex: 10,
      }}
    >
      {/* El centro del reproductor (donde YouTube pone su botón de play) queda bajo el dedo. */}
      <View style={{ position: 'absolute', width: W, height: H, left: -(W - hostSize) / 2, top: -(H - hostSize) / 2 }}>
        <YoutubePlayer
          ref={inner}
          width={W}
          height={H}
          videoId={videoId}
          play={force ?? playing}
          webViewProps={{ allowsInlineMediaPlayback: true, mediaPlaybackRequiresUserAction: false }}
          onReady={() => onLog?.('listo')}
          onChangeState={(state: string) => {
            onLog?.(`estado: ${state}`);
            if (forcing.current) return;
            if (state === 'ended') onEnded();
            else if (state === 'playing') onPlayingChange(true);
            else if (state === 'paused') onPlayingChange(false);
          }}
          onError={(reason: string) => { onLog?.(`error: ${reason}`); onError(reason); }}
        />
      </View>
    </View>
  );
});