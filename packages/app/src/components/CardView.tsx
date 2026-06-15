import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, rankLabel } from '../../../shared/src';
import { colors } from '../theme';

const SUIT_GLYPH: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
// 4色デッキ（スペード黒・ハート赤・ダイヤ青・クラブ緑）で視認性を上げる
const SUIT_COLOR: Record<string, string> = {
  s: '#1c1c1c',
  h: '#c0392b',
  d: '#1565c0',
  c: '#2e7d32',
};

type CardSize = 'normal' | 'mini' | 'micro';

interface Props {
  card: Card;
  size?: CardSize;
  selected?: boolean;
  pending?: boolean;
  discard?: boolean; // このカードが捨て札になる（残り1枚）
  onPress?: () => void;
}

export function CardView({ card, size = 'normal', selected, pending, discard, onPress }: Props) {
  const color = SUIT_COLOR[card.suit];
  const body = (
    <View
      style={[
        styles.card,
        sizeStyles[size],
        selected && styles.selected,
        pending && styles.pending,
        discard && styles.discard,
      ]}
    >
      <Text style={[styles.rank, rankStyles[size], { color }]}>{rankLabel(card.rank)}</Text>
      <Text style={[styles.suit, suitStyles[size], { color }]}>{SUIT_GLYPH[card.suit]}</Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}
    >
      {body}
    </Pressable>
  );
}

// 空きスロット
export function CardSlot({ size = 'normal' }: { size?: CardSize }) {
  return <View style={[styles.slot, sizeStyles[size]]} />;
}

// 裏向きカード（FL中の相手など）
export function CardBack({ size = 'normal' }: { size?: CardSize }) {
  return (
    <View style={[styles.card, styles.back, sizeStyles[size]]}>
      <Text style={styles.backText}>◆</Text>
    </View>
  );
}

const sizeStyles = StyleSheet.create({
  normal: { width: 54, height: 76, margin: 2 },
  mini: { width: 24, height: 33, margin: 1, borderRadius: 3 },
  micro: { width: 17, height: 24, margin: 0.5, borderRadius: 2 },
});

const rankStyles = StyleSheet.create({
  normal: { fontSize: 21, lineHeight: 25 },
  mini: { fontSize: 12, lineHeight: 13 },
  micro: { fontSize: 9, lineHeight: 10 },
});

const suitStyles = StyleSheet.create({
  normal: { fontSize: 17, lineHeight: 19 },
  mini: { fontSize: 9, lineHeight: 10 },
  micro: { fontSize: 7, lineHeight: 8 },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardFace,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    borderColor: colors.accent,
    borderWidth: 3,
    transform: [{ translateY: -8 }],
    boxShadow: '0 0 10px rgba(61, 220, 151, 0.65)',
  },
  pending: { borderColor: colors.pending, borderWidth: 2, backgroundColor: '#fff8dc' },
  discard: { borderColor: colors.danger, borderWidth: 3, opacity: 0.6 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },
  rank: { fontWeight: '700' },
  suit: {},
  slot: {
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: colors.slot,
  },
  back: { backgroundColor: '#7c2d3e', borderColor: '#5a1f2d' },
  backText: { color: '#d9a0ae', fontSize: 10 },
});
