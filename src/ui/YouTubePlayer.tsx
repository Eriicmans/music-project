import React from 'react';
import { useWindowDimensions } from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';

export interface PlayerProps {
  videoId: string;
  playing: boolean;
  onEnded: () => void;
  onError: (reason: string) => void;
  onPlayingChange: (playing: boolean) => void;
}

/**
 * ÚNICO archivo que conoce el motor de reproducción (iframe oficial de YouTube).
 * Para cambiar a otra vía (p. ej. audio en segundo plano) basta con reescribir
 * este componente manteniendo las mismas props.
 */
export function YouTubePlayer({ videoId, playing, onEnded, onError, onPlayingChange }: PlayerProps) {
  const { width } = useWindowDimensions();
  const w = Math.max(200, width - 48);
  return (
    <YoutubePlayer
      width={w}
      height={Math.round((w * 9) / 16)}
      videoId={videoId}
      play={playing}
      onChangeState={(state: string) => {
        if (state === 'ended') onEnded();
        else if (state === 'playing') onPlayingChange(true);
        else if (state === 'paused') onPlayingChange(false);
      }}
      onError={(reason: string) => onError(reason)}
    />
  );
}
