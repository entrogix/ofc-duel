import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

// 「オープンフェイス・チャイニーズポーカー・デュエル」のロゴ
// 4色スートのカードチップ + OFC(金) + DUELバッジ(赤・斜体)
const SUITS: { glyph: string; color: string }[] = [
  { glyph: '♠', color: '#1c1c1c' },
  { glyph: '♥', color: '#c0392b' },
  { glyph: '♦', color: '#1565c0' },
  { glyph: '♣', color: '#2e7d32' },
];

export function Logo({ size = 'large' }: { size?: 'large' | 'small' }) {
  const s = size === 'large' ? 1 : 0.55;
  return (
    <View style={styles.wrap}>
      <View style={[styles.suitRow, { gap: 6 * s }]}>
        {SUITS.map((suit, i) => (
          <View key={i} style={[styles.suitChip, { width: 34 * s, height: 44 * s, borderRadius: 6 * s }]}>
            <Text style={{ fontSize: 24 * s, color: suit.color, fontWeight: '700' }}>{suit.glyph}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.ofc, { fontSize: 64 * s, marginTop: 8 * s }]}>OFC</Text>
      <View style={[styles.turboBadge, { paddingHorizontal: 18 * s, paddingVertical: 3 * s, marginTop: 2 * s }]}>
        <Text style={[styles.turbo, { fontSize: 22 * s }]}>D U E L</Text>
      </View>
      <Text style={[styles.subtitle, { fontSize: 11 * s, marginTop: 10 * s }]}>
        オープンフェイス・チャイニーズポーカー・デュエル
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  suitRow: { flexDirection: 'row' },
  suitChip: {
    backgroundColor: colors.cardFace,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
  },
  ofc: {
    color: colors.gold,
    fontWeight: '900',
    letterSpacing: 10,
  },
  turboBadge: {
    backgroundColor: '#b71c1c',
    borderRadius: 4,
    transform: [{ skewX: '-10deg' }],
    borderWidth: 1,
    borderColor: '#ffd700',
  },
  turbo: {
    color: '#fff',
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 2,
  },
  subtitle: { color: colors.textDim, letterSpacing: 1 },
});
