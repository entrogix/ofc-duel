import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { PopIn } from './anim';

interface Props {
  visible: boolean;
  message: string;
  yesLabel?: string;
  noLabel?: string;
  onYes: () => void;
  onNo: () => void;
}

// RN Alert はWebで動かないため自前の確認モーダル
export function ConfirmModal({ visible, message, yesLabel = 'はい', noLabel = 'いいえ', onYes, onNo }: Props) {
  if (!visible) return null;
  return (
    <View style={styles.backdrop}>
      <PopIn>
        <View style={styles.box}>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.buttons}>
            <Pressable style={styles.noBtn} onPress={onNo}>
              <Text style={styles.noText}>{noLabel}</Text>
            </Pressable>
            <Pressable style={styles.yesBtn} onPress={onYes}>
              <Text style={styles.yesText}>{yesLabel}</Text>
            </Pressable>
          </View>
        </View>
      </PopIn>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
    padding: 24,
  },
  box: {
    backgroundColor: colors.feltDark,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.goldDim,
    padding: 18,
    width: 280,
  },
  message: { color: colors.text, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 16 },
  noBtn: {
    flex: 1,
    borderColor: colors.textDim,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  noText: { color: colors.textDim, fontWeight: '700' },
  yesBtn: {
    flex: 1,
    backgroundColor: colors.danger,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  yesText: { color: '#fff', fontWeight: '800' },
});
