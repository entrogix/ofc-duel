import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { HandHistoryEntry } from '../../../shared/src';
import { colors } from '../theme';

interface Props {
  visible: boolean;
  history: HandHistoryEntry[];
  myName: string;
  oppName: string;
  onClose: () => void;
}

export function HandHistoryModal({ visible, history, myName, oppName, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>ハンド履歴</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          {/* ヘッダー行 */}
          <View style={styles.headerRow}>
            <Text style={[styles.cell, styles.cellHand]}>H</Text>
            <Text style={[styles.cell, styles.cellName]} numberOfLines={1}>{myName}</Text>
            <Text style={[styles.cell, styles.cellChip]}>💰</Text>
            <Text style={[styles.cell, styles.cellName]} numberOfLines={1}>{oppName}</Text>
            <Text style={[styles.cell, styles.cellChip]}>💰</Text>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {history.length === 0 ? (
              <Text style={styles.empty}>まだ精算済みハンドがありません</Text>
            ) : (
              [...history].reverse().map((h) => (
                <View key={h.handNumber} style={styles.row}>
                  <Text style={[styles.cell, styles.cellHand, styles.rowText]}>{h.handNumber}</Text>
                  <Text style={[styles.cell, styles.cellName, netStyle(h.myNet)]}>
                    {netLabel(h.myNet)}{flBadge(h.fantasyEntered, h.fantasyStayed)}
                  </Text>
                  <Text style={[styles.cell, styles.cellChip, styles.chipText]}>{h.myChipsAfter}</Text>
                  <Text style={[styles.cell, styles.cellName, netStyle(h.oppNet)]}>
                    {netLabel(h.oppNet)}
                  </Text>
                  <Text style={[styles.cell, styles.cellChip, styles.chipText]}>{h.oppChipsAfter}</Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function netLabel(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `${n}`;
  return '±0';
}

function flBadge(entered: boolean, stayed: boolean): string {
  if (entered) return ' 🎡';
  if (stayed) return ' 🎡↩';
  return '';
}

function netStyle(n: number) {
  if (n > 0) return styles.netPos;
  if (n < 0) return styles.netNeg;
  return styles.netZero;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.feltDark,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 12,
    paddingBottom: 32,
    maxHeight: '70%',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  title: { color: colors.gold, fontSize: 16, fontWeight: '800' },
  close: { color: colors.textDim, fontSize: 18, fontWeight: '700' },
  headerRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.goldDim,
  },
  list: { flexGrow: 0 },
  listContent: { paddingHorizontal: 12, paddingTop: 4 },
  row: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  cell: { textAlign: 'center' },
  cellHand: { width: 28, color: colors.textDim, fontSize: 12 },
  cellName: { flex: 1, fontSize: 13, fontWeight: '700' },
  cellChip: { width: 38, fontSize: 12 },
  rowText: { color: colors.textDim },
  chipText: { color: colors.text },
  netPos: { color: '#4caf50' },
  netNeg: { color: colors.danger },
  netZero: { color: colors.textDim },
  empty: { color: colors.textDim, textAlign: 'center', paddingVertical: 20, fontSize: 13 },
});
