import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { adsAvailable } from './env';

export function AdBanner() {
  // Expo Go では広告モジュールが無いのでダミー枠（importも走らせない）
  if (!adsAvailable) {
    return (
      <View style={styles.box}>
        <Text style={styles.txt}>広告（実機ビルドで表示）</Text>
      </View>
    );
  }
  // 実機ビルドでのみネイティブモジュールを読み込む（トップレベルimportだとExpo Goで即クラッシュするため遅延require）
  // TODO: リリース時は TestIds.BANNER を本番のバナー広告ユニットIDに差し替える
  const { BannerAd, BannerAdSize, TestIds } = require('react-native-google-mobile-ads');
  return (
    <View style={{ alignItems: 'center' }}>
      <BannerAd
        unitId={TestIds.BANNER}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      />
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
