import { adsAvailable } from './env';

// 対戦終了時に全画面（動画）広告を表示する。
// 広告が閉じられた/読み込み失敗/タイムアウトのいずれかで resolve する（必ず先へ進める）。
// TODO: リリース時は TestIds.INTERSTITIAL を本番のインタースティシャル広告ユニットIDに差し替える
export function showInterstitialAd(): Promise<void> {
  if (!adsAvailable) return Promise.resolve(); // Expo Go では広告なしで即進行（モジュールも読み込まない）
  // 実機ビルドでのみネイティブモジュールを読み込む（遅延require）
  const { AdEventType, InterstitialAd, TestIds } = require('react-native-google-mobile-ads');
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    try {
      const ad = InterstitialAd.createForAdRequest(TestIds.INTERSTITIAL, { requestNonPersonalizedAdsOnly: true });
      ad.addAdEventListener(AdEventType.LOADED, () => ad.show());
      ad.addAdEventListener(AdEventType.CLOSED, finish);
      ad.addAdEventListener(AdEventType.ERROR, finish);
      ad.load();
      setTimeout(finish, 8000); // ロードに失敗してもゲームを止めない
    } catch {
      finish();
    }
  });
}
