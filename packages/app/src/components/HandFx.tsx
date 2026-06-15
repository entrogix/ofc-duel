import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet } from 'react-native';
import { colors } from '../theme';

const useNative = Platform.OS !== 'web';

// 役の強さ → 演出の強さ（0は演出なし）
export function handTier(label: string): number {
  switch (label) {
    case 'ワンペア': return 1;
    case 'ツーペア': return 2;
    case 'スリーカード': return 2;
    case 'ストレート': return 3;
    case 'フラッシュ': return 3;
    case 'フルハウス': return 3;
    case 'フォーカード': return 4;
    case 'ストレートフラッシュ': return 4;
    case 'ロイヤルフラッシュ': return 4;
    default: return 0;
  }
}

const TIER_STYLE = [
  {},
  { fontSize: 16, color: colors.pending },
  { fontSize: 20, color: '#ffb347' },
  { fontSize: 25, color: '#ff7b54' },
  { fontSize: 30, color: '#ffd700' },
];
const TIER_PREFIX = ['', '', '⭐ ', '🔥 ', '👑 '];

interface Props {
  label: string;
  tier: number;
  onDone: () => void;
}

// 役完成時に行の上へポップするバナー。強い役ほど大きく・長く表示
export function HandFx({ label, tier, onDone }: Props) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.spring(v, { toValue: 1, friction: 4, tension: 180, useNativeDriver: useNative }),
      Animated.delay(350 + tier * 250),
      Animated.timing(v, { toValue: 2, duration: 250, useNativeDriver: useNative }),
    ]).start(({ finished }) => {
      if (finished) onDone();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          opacity: v.interpolate({ inputRange: [0, 0.5, 1, 1.7, 2], outputRange: [0, 1, 1, 1, 0] }),
          transform: [
            { scale: v.interpolate({ inputRange: [0, 1, 2], outputRange: [0.3, 1, 1.35] }) },
            { translateY: v.interpolate({ inputRange: [0, 1, 2], outputRange: [8, 0, -14] }) },
          ],
        },
      ]}
    >
      <Animated.Text style={[styles.text, TIER_STYLE[tier]]}>
        {TIER_PREFIX[tier]}{label}！
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: -14,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 500,
  },
  text: {
    fontWeight: '900',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
