// デフォルト実装（Web / Expo Go / tsc 用）。広告は出さず即解決。
// 実機ビルドでは interstitial.native.ts が使われる。
export function showInterstitialAd(): Promise<void> {
  return Promise.resolve();
}
