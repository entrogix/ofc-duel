import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Platform, StyleSheet, Text } from 'react-native';

const useNative = Platform.OS !== 'web';
const PIECES = ['🎉', '✨', '🎊', '⭐', '🃏', '💰'];

function Piece({ index }: { index: number }) {
  const v = useRef(new Animated.Value(0)).current;
  const { height, width } = Dimensions.get('window');
  const x = (index * 137) % Math.min(width, 480); // 擬似ランダムに横へ散らす
  const sway = 20 + ((index * 53) % 40);
  const duration = 2600 + ((index * 211) % 1800);
  const delay = (index * 167) % 1500;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration, useNativeDriver: useNative }),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: useNative }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay, duration]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x,
        top: -40,
        opacity: v.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, height + 80] }) },
          { translateX: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, sway, -sway / 2] }) },
          { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${360 + index * 40}deg`] }) },
        ],
      }}
    >
      <Text style={styles.piece}>{PIECES[index % PIECES.length]}</Text>
    </Animated.View>
  );
}

// ゲーム終了時の紙吹雪。親（絶対配置の全画面View）に重ねて使う
export function Confetti({ count = 22 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Piece key={i} index={i} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  piece: { fontSize: 22 },
});
