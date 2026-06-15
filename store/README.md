# ストア公開 提出物一式（OFCターボ）

最終更新: 2026-06-14

このフォルダにストア提出に使う成果物をまとめてある。
「✅ 用意済み」はこのリポジトリにあるもの、「🔲 あなたの作業」はアカウントや実機が必要で代行できないもの。

## 1. アプリ本体・ビルド設定

| 項目 | 状態 | 場所 |
|---|---|---|
| アプリアイコン（iOS/汎用） | ✅ | `packages/app/assets/icon.png` |
| Androidアダプティブアイコン（前景/背景/モノクロ） | ✅ | `packages/app/assets/android-icon-*.png` |
| スプラッシュ画像 | ✅ | `packages/app/assets/splash-icon.png` |
| favicon | ✅ | `packages/app/assets/favicon.png` |
| bundleId / package（`com.entrogix.ofcturbo`）・バージョン | ✅ | `packages/app/app.json` |
| EASビルド設定 | ✅ | `packages/app/eas.json` |
| アイコン再生成スクリプト | ✅ | `packages/app/scripts/generate-assets.mjs` |

## 2. ストア掲載物（テキスト・画像）

| 項目 | 状態 | 場所 |
|---|---|---|
| アプリ名・説明文・短い説明・キーワード | ✅ | `docs/store-listing.md` |
| フィーチャーグラフィック 1024×500（Google Play） | ✅ | `store/feature-graphic.png` |
| スクリーンショット | ✅ 下書き / 🔲 実機推奨 | `store/screenshots/` |

> スクリーンショットは Web プレビューから撮った下書き。審査は通るが、**実機（EAS Buildのプレビュービルド）で撮り直すと品質が上がる**。
> 必須サイズ: App Store iPhone 6.7"（1290×2796）、Google Play は最低2枚（縦長 9:16 など、各辺320〜3840px）。

## 3. 法務・プライバシー

| 項目 | 状態 | 場所 / 備考 |
|---|---|---|
| プライバシーポリシー（Markdown） | ✅ | `docs/privacy-policy.md` |
| プライバシーポリシー（HTML・公開用） | ✅ | `store/privacy-policy.html` → GitHub Pages等で公開しURLをストアに登録 |
| データ安全性 / App Privacy 申告ガイド | ✅ | `docs/release-checklist.md` |
| app-ads.txt | ✅ ひな形 | `store/app-ads.txt`（pub-IDの差し替え必要） |

## 4. 🔲 あなたにしかできない作業

1. **Google Play デベロッパー登録**（$25・買い切り）＋ 個人は本人確認
2. **Apple Developer Program 登録**（$99/年）
3. **AdMob でアプリ登録** → 本番 App ID・広告ユニットID取得 → コードのTestIdsと app.json を差し替え（手順は `docs/release-checklist.md`）
4. **EAS Build で本番バイナリ作成**：`eas build -p android --profile production` / `-p ios`
5. **Google Play クローズドテスト**：テスター12人を14日間（新規個人アカウントの公開要件）
6. プライバシーポリシーHTMLをWeb公開してURL確定
7. 年齢レーティング質問票（IARC）回答：実マネー賭博なし／シミュレートされたギャンブルあり

## 5. 参照ドキュメント

- 公開全体の段取り・費用: [`docs/release-checklist.md`](../docs/release-checklist.md)
- 掲載文ドラフト: [`docs/store-listing.md`](../docs/store-listing.md)
- オンライン対戦サーバーの公開: [`docs/online-deployment.md`](../docs/online-deployment.md)
