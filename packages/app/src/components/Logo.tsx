import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const GOLD = '#d4af37';
const GOLD_DARK = '#a07c10';
const CARD_BG = '#d4af37';
const CARD_BORDER = '#1a1400';
const SPADE = '#0b3d2e';
const HEART = '#c41a1a';
const BG_MATCH = '#00593b';

function PlayingCard({
  suit,
  suitColor,
  rotate,
  posStyle,
  s,
}: {
  suit: string;
  suitColor: string;
  rotate: string;
  posStyle: object;
  s: number;
}) {
  const w = 82 * s;
  const h = 108 * s;
  const r = 12 * s;
  const rankSz = 13 * s;
  const suitSz = 44 * s;
  return (
    <View style={[{
      position: 'absolute',
      width: w, height: h, borderRadius: r,
      backgroundColor: CARD_BG,
      borderWidth: 2.5 * s,
      borderColor: CARD_BORDER,
      alignItems: 'center',
      justifyContent: 'center',
      transform: [{ rotate }],
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 6,
      elevation: 8,
    }, posStyle]}>
      {/* 左上ランク */}
      <View style={{ position: 'absolute', top: 5 * s, left: 6 * s, alignItems: 'center' }}>
        <Text style={{ fontSize: rankSz, fontWeight: '900', color: suitColor, lineHeight: rankSz }}>A</Text>
        <Text style={{ fontSize: rankSz * 0.85, color: suitColor, lineHeight: rankSz * 0.85 }}>{suit}</Text>
      </View>
      {/* 中央スート */}
      <Text style={{ fontSize: suitSz, color: suitColor }}>{suit}</Text>
      {/* 右下ランク（逆さ） */}
      <View style={{ position: 'absolute', bottom: 5 * s, right: 6 * s, alignItems: 'center', transform: [{ rotate: '180deg' }] }}>
        <Text style={{ fontSize: rankSz, fontWeight: '900', color: suitColor, lineHeight: rankSz }}>A</Text>
        <Text style={{ fontSize: rankSz * 0.85, color: suitColor, lineHeight: rankSz * 0.85 }}>{suit}</Text>
      </View>
    </View>
  );
}

export function Logo({ size = 'large' }: { size?: 'large' | 'small' }) {
  const s = size === 'large' ? 1 : 0.52;
  const wrapW = 158 * s;
  const wrapH = 130 * s;

  return (
    <View style={styles.outer}>
      {/* スパークル */}
      {size === 'large' && (
        <View style={[styles.sparkLayer, { width: wrapW + 50, height: wrapH + 10 }]}>
          <Text style={[styles.spark, { top: 0,   left: 8,   fontSize: 18 }]}>✦</Text>
          <Text style={[styles.dot,   { top: 8,   left: 38,  fontSize: 7  }]}>●</Text>
          <Text style={[styles.dot,   { top: 46,  left: 2,   fontSize: 5  }]}>●</Text>
          <Text style={[styles.dot,   { top: 2,   right: 50, fontSize: 5  }]}>●</Text>
          <Text style={[styles.spark, { top: 88,  right: 6,  fontSize: 12 }]}>✦</Text>
          <Text style={[styles.dot,   { top: 106, right: 26, fontSize: 8  }]}>●</Text>
        </View>
      )}

      {/* カード2枚 */}
      <View style={{ width: wrapW, height: wrapH }}>
        <PlayingCard suit="♠" suitColor={SPADE} rotate="-15deg"
          posStyle={{ left: 0,  top: 14 * s }} s={s} />
        <PlayingCard suit="♥" suitColor={HEART} rotate="9deg"
          posStyle={{ right: 0, top: 4 * s }} s={s} />
      </View>

      {/* タイトル */}
      <View style={[styles.titleWrap, { marginTop: 10 * s }]}>
        <Text style={[styles.titleOfc, { fontSize: 36 * s, letterSpacing: 6 * s }]}>OFC</Text>
        <View style={[styles.duelBadge, { paddingHorizontal: 14 * s, paddingVertical: 3 * s, borderRadius: 4 * s, marginTop: 2 * s }]}>
          <Text style={[styles.titleDuel, { fontSize: 18 * s, letterSpacing: 5 * s }]}>DUEL</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { alignItems: 'center' },
  sparkLayer: { position: 'absolute', top: 0, alignSelf: 'center' },
  spark: { position: 'absolute', color: GOLD },
  dot:   { position: 'absolute', color: GOLD },
  titleWrap: { alignItems: 'center' },
  titleOfc: {
    color: GOLD,
    fontWeight: '900',
    textShadowColor: GOLD_DARK,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  duelBadge: {
    backgroundColor: CARD_BORDER,
    borderWidth: 1.5,
    borderColor: GOLD,
  },
  titleDuel: {
    color: GOLD,
    fontWeight: '900',
  },
});
