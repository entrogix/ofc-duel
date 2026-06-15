import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

// デフォルト実装（Web / Expo Go / tsc 用のダミー枠）。
// 実機ビルドでは AdBanner.native.tsx が使われ、実際のAdMobバナーが表示される。
export function AdBanner() {
  return (
    <View style={styles.box}>
      <Text style={styles.txt}>広告</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.panelLight,
  },
  txt: { color: colors.textDim, fontSize: 10 },
});
