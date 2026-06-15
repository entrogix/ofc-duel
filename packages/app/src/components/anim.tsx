import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleProp, ViewStyle } from 'react-native';
import { getSettings } from '../settings';

const useNative = Platform.OS !== 'web';

interface AnimProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  duration?: number;
}

// 下からふわっと出現（配札・リスト用）
export function FadeSlideIn({ children, style, delay = 0, duration = 240, dy = 18 }: AnimProps & { dy?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (getSettings().reduceMotion) { v.setValue(1); return; }
    Animated.timing(v, { toValue: 1, duration, delay, useNativeDriver: useNative }).start();
  }, [v, delay, duration]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// バネで弾んで出現（カード配置用）
export function PopIn({ children, style, delay = 0 }: AnimProps) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (getSettings().reduceMotion) { v.setValue(1); return; }
    const anim = Animated.spring(v, { toValue: 1, friction: 5, tension: 160, delay, useNativeDriver: useNative });
    anim.start();
    return () => anim.stop();
  }, [v, delay]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// フェードのみ（オーバーレイ背景用）
export function FadeIn({ children, style, delay = 0, duration = 180 }: AnimProps) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (getSettings().reduceMotion) { v.setValue(1); return; }
    Animated.timing(v, { toValue: 1, duration, delay, useNativeDriver: useNative }).start();
  }, [v, delay, duration]);
  return <Animated.View style={[style, { opacity: v }]}>{children}</Animated.View>;
}

// ゆっくり明滅し続ける（「タップしてスタート」用）
export function Pulse({ children, style }: AnimProps) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (getSettings().reduceMotion) { v.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: useNative }),
        Animated.timing(v, { toValue: 0, duration: 700, useNativeDriver: useNative }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View style={[style, { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }]}>
      {children}
    </Animated.View>
  );
}
