import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Platform, StyleSheet, Text } from 'react-native';

const useNative = Platform.OS !== 'web';

// FL突入時のカットイン: 斜めの帯が走り、文字が左から滑り込んで止まり、右へ抜ける
export function FantasyCutIn({ onDone }: { onDone: () => void }) {
  const v = useRef(new Animated.Value(0)).current;
  const w = Math.min(Dimensions.get('window').width, 480);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 320, useNativeDriver: useNative }),
      Animated.delay(1100),
      Animated.timing(v, { toValue: 2, duration: 320, useNativeDriver: useNative }),
    ]).start(() => onDone());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.overlay,
        { opacity: v.interpolate({ inputRange: [0, 0.25, 1.75, 2], outputRange: [0, 1, 1, 0] }) },
      ]}
    >
      <Animated.View
        style={[
          styles.band,
          {
            transform: [
              { rotate: '-5deg' },
              { translateX: v.interpolate({ inputRange: [0, 1, 2], outputRange: [-w, 0, w] }) },
            ],
          },
        ]}
      >
        <Text style={styles.wheel}>🎡</Text>
        <Text style={styles.title}>FANTASY LAND!!</Text>
        <Text style={styles.sub}>13枚一括配置のフィーバータイム！</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 1500,
    backgroundColor: 'rgba(20, 0, 40, 0.55)',
  },
  band: {
    backgroundColor: '#4a148c',
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderColor: '#ffd700',
    paddingVertical: 18,
    alignItems: 'center',
  },
  wheel: { fontSize: 40 },
  title: {
    color: '#ffd700',
    fontSize: 32,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 2,
  },
  sub: { color: '#f3e5f5', fontSize: 13, fontWeight: '700', marginTop: 4 },
});
