import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import { clamp01 } from '../core/player/format';
import { colors } from './theme';

interface Props {
  /** 0..1 */
  value: number;
  disabled?: boolean;
  /** Mientras se arrastra (fracción 0..1), o null al soltar. */
  onScrub?: (fraction: number | null) => void;
  /** Al soltar. */
  onSeek: (fraction: number) => void;
}

/** Barra de progreso arrastrable (toque o arrastre). */
export function Slider({ value, disabled, onScrub, onSeek }: Props) {
  const [drag, setDrag] = useState<number | null>(null);
  const width = useRef(1);
  const start = useRef(0);
  const cb = useRef({ onScrub, onSeek, disabled });
  cb.current = { onScrub, onSeek, disabled };

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !cb.current.disabled,
    onMoveShouldSetPanResponder: () => !cb.current.disabled,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: e => {
      start.current = clamp01(e.nativeEvent.locationX / width.current);
      setDrag(start.current); cb.current.onScrub?.(start.current);
    },
    onPanResponderMove: (_, g) => {
      const f = clamp01(start.current + g.dx / width.current);
      setDrag(f); cb.current.onScrub?.(f);
    },
    onPanResponderRelease: (_, g) => {
      const f = clamp01(start.current + g.dx / width.current);
      setDrag(null); cb.current.onScrub?.(null); cb.current.onSeek(f);
    },
    onPanResponderTerminate: () => { setDrag(null); cb.current.onScrub?.(null); },
  }), []);

  const f = clamp01(drag ?? value);
  return (
    <View
      {...pan.panHandlers}
      onLayout={e => { width.current = Math.max(1, e.nativeEvent.layout.width); }}
      style={{ height: 30, justifyContent: 'center' }}
    >
      <View pointerEvents="none" style={{ height: 4, borderRadius: 2, backgroundColor: colors.onDarkLine, overflow: 'visible' }}>
        <View style={{ width: `${f * 100}%`, height: 4, borderRadius: 2, backgroundColor: colors.onDark }} />
        <View style={{
          position: 'absolute', left: `${f * 100}%`, top: -5, marginLeft: -7, width: 14, height: 14, borderRadius: 7,
          backgroundColor: colors.onDark, opacity: drag !== null || f > 0 ? 1 : 0.6,
        }} />
      </View>
    </View>
  );
}
