import React, { ReactNode, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleProp, ViewStyle } from 'react-native';

/** Pulsable que se encoge un poco al tocarlo. `style` se aplica a la vista animada (no al Pressable). */
export function PressScale({ children, onPress, onLongPress, style, scale = 0.96, disabled }: {
  children: ReactNode; onPress?: () => void; onLongPress?: () => void;
  style?: StyleProp<ViewStyle>; scale?: number; disabled?: boolean;
}) {
  const v = useRef(new Animated.Value(1)).current;
  const to = (x: number) => Animated.spring(v, { toValue: x, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} disabled={disabled} onPressIn={() => to(scale)} onPressOut={() => to(1)}>
      <Animated.View style={[style, { transform: [{ scale: v }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Aparece con un fundido y un pequeño desplazamiento hacia arriba al montarse. */
export function FadeIn({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 380, delay, useNativeDriver: true }).start();
  }, [v, delay]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}
