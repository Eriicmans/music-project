import { RefObject, useCallback, useEffect, useState } from 'react';
import { PlayerHandle } from './YouTubePlayer';

/** Posición y duración (segundos) de la canción actual, consultadas al motor mientras suena. */
export function usePlayerProgress(engine: RefObject<PlayerHandle | null>, playing: boolean, videoId: string) {
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => { setPosition(0); setDuration(0); }, [videoId]);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const h = engine.current;
        if (!h) return;
        const [t, d] = await Promise.all([h.getCurrentTime(), h.getDuration()]);
        if (!stop) { setPosition(t); setDuration(d); }
      } catch { /* el motor aún no está listo */ }
    };
    tick();
    if (!playing) return () => { stop = true; };
    const id = setInterval(tick, 500);
    return () => { stop = true; clearInterval(id); };
  }, [engine, playing, videoId]);

  /** Para reflejar un salto al instante sin esperar a la siguiente consulta. */
  const set = useCallback((sec: number) => setPosition(sec), []);
  return { position, duration, set };
}
