import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { OpponentView, ROWS } from '../../../shared/src';
import { colors } from '../theme';
import { CardBack, CardSlot, CardView } from './CardView';

interface Props {
  opp: OpponentView;
  // 相手が3人いるときは micro サイズで横幅に収める
  compact?: boolean;
}

export function OpponentBoard({ opp, compact }: Props) {
  const cardSize = compact ? 'micro' : 'mini';
  return (
    <View style={[styles.box, compact && styles.boxCompact]}>
      <View style={styles.header}>
        <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={1}>
          {opp.isDealer ? '🔘' : ''}{opp.name}
        </Text>
        <Text style={[styles.chips, compact && styles.chipsCompact]}>{opp.chips}</Text>
      </View>
      <View style={styles.badges}>
        {opp.inFantasy && <Text style={styles.fl}>FL</Text>}
        {opp.submitted ? <Text style={styles.done}>✔</Text> : <Text style={styles.thinking}>…</Text>}
      </View>
      {opp.hiddenFantasy ? (
        <View style={[styles.hiddenBox, compact && styles.hiddenBoxCompact]}>
          {Array.from({ length: 13 }).map((_, i) => (
            <CardBack key={i} size={cardSize} />
          ))}
        </View>
      ) : (
        ROWS.map((row) => (
          <View key={row} style={styles.row}>
            {opp.board[row].map((c, i) => (
              <CardView key={i} card={c} size={cardSize} />
            ))}
            {Array.from({ length: (row === 'front' ? 3 : 5) - opp.board[row].length }).map((_, i) => (
              <CardSlot key={`s${i}`} size={cardSize} />
            ))}
          </View>
        ))
      )}
      {/* 相手の捨て札 */}
      {opp.discards.length > 0 && (
        <View style={styles.discardRow}>
          <Text style={styles.discardLabel}>🗑</Text>
          {opp.discards.map((c, i) => (
            <CardView key={`d${i}`} card={c} size="micro" />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.panel,
    borderRadius: 8,
    padding: 6,
    margin: 3,
    minWidth: 138,
  },
  boxCompact: { minWidth: 0, padding: 4, margin: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: colors.text, fontSize: 12, fontWeight: '600', flexShrink: 1 },
  nameCompact: { fontSize: 10 },
  chips: { color: colors.gold, fontSize: 11, fontWeight: '700', marginLeft: 4 },
  chipsCompact: { fontSize: 10, marginLeft: 2 },
  discardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', marginTop: 2 },
  discardLabel: { color: colors.textDim, fontSize: 8, marginRight: 1 },
  badges: { flexDirection: 'row', gap: 4, marginVertical: 1 },
  fl: {
    color: '#111',
    backgroundColor: colors.pending,
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 4,
    borderRadius: 3,
    overflow: 'hidden',
  },
  done: { color: colors.accent, fontSize: 10, fontWeight: '700' },
  thinking: { color: colors.textDim, fontSize: 10 },
  row: { flexDirection: 'row', justifyContent: 'center', marginVertical: 0.5 },
  hiddenBox: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', maxWidth: 138 },
  hiddenBoxCompact: { maxWidth: 100 },
});
