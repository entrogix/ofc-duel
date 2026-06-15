import { adsAvailable } from './env';

// 起動時に1回呼ぶ。iOSではATT（トラッキング許可）を求めてからAdMobを初期化する。
export async function initAds(): Promise<void> {
  if (!adsAvailable) return; // Expo Go ではネイティブモジュールが無いので何もしない（require もしない）
  // 実機ビルドでのみ読み込む（遅延require）
  const { requestTrackingPermissionsAsync } = require('expo-tracking-transparency');
  const mobileAds = require('react-native-google-mobile-ads').default;
  try {
    await requestTrackingPermissionsAsync();
  } catch {
    // 拒否・非対応でも続行（非パーソナライズ広告が出る）
  }
  try {
    await mobileAds().initialize();
  } catch {
    // 初期化失敗時も広告なしで継続
  }
}
