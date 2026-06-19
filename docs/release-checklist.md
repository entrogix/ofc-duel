# OFCデュエル — ストア公開＆広告掲載の下準備チェックリスト

作成日: 2026-06-13（料金・要件は変わるため申請前に公式で再確認すること）

## まとめ（先にやるべき順）

1. **Google Play デベロッパーアカウント作成（$25・買い切り）** ← 審査・テスト期間が長いので最優先
2. **Apple Developer Program 登録（$99/年 ≒ 15,800円/年）**
3. **AdMob アカウント作成（無料）** ← 上2つと並行でOK
4. **プライバシーポリシーのページを用意**（広告を載せるなら両ストアで必須）
5. EAS Build でストア用バイナリを作る（コード側の対応）

---

## 1. Google Play（Android）

| 項目 | 内容 |
|---|---|
| 費用 | **$25（買い切り）** |
| 登録 | [Play Console](https://play.google.com/console) — Googleアカウント＋本人確認書類（運転免許証等）＋デベロッパー本人確認あり |
| 個人の注意 | 個人アカウントは**法的な氏名と住所がストアに公開される**（2024年〜）。気になる場合は法人/組織アカウント（D-U-N-S番号が必要） |
| ⚠️ 最重要 | **新規個人アカウントは「12人以上のテスターが14日間連続でオプトインするクローズドテスト」を通過しないと本番公開できない**（[公式ヘルプ](https://support.google.com/googleplay/android-developer/answer/14151465?hl=ja)）。当初20人→2024年12月に12人へ緩和 |
| テスター集め | 友人・家族のGmailで12人確保が現実解。不足分は「Testers Community」等の相互テストコミュニティも使われている |
| 想定リードタイム | アカウント作成〜本番公開まで **最短でも3〜4週間**（テスト14日＋審査） |

## 2. App Store（iOS）

| 項目 | 内容 |
|---|---|
| 費用 | **$99/年（個人）** |
| 登録 | [Apple Developer Program](https://developer.apple.com/programs/) — Apple ID＋本人確認。個人はD-U-N-S不要 |
| 必要機材 | 提出にはmacが原則必要だが、**EAS Build（クラウド）を使えばWindowsだけでipa作成〜提出まで可能** |
| 審査 | 通常1〜3日。ギャンブル類似アプリは「実マネーを賭けない」ことを審査ノートに明記すると安全（本作はチップ制で換金なし→問題なし。レーティングは「疑似ギャンブル」で17+/12+相当になる可能性） |
| その他 | App用プライバシー栄養ラベル（収集データの申告）、スクリーンショット（6.7" / 6.1" 必須） |

## 3. 広告（AdMob 推奨）

| 項目 | 内容 |
|---|---|
| アカウント | [AdMob](https://admob.google.com/)（無料）。AdSenseと共通のGoogleアカウント体系。**支払い情報＋税務情報（日本の個人でOK）** を登録 |
| 実装 | Expoでは `react-native-google-mobile-ads` ＋ config plugin。**Expo Goでは動かない → EAS Build（development build）必須** |
| iOS要件 | **ATT（App Tracking Transparency）** のダイアログ実装＋Info.plistの`NSUserTrackingUsageDescription`。拒否されたら非パーソナライズ広告を出す |
| EU向け | GDPR同意（Google UMP SDK / 認定CMP）。日本のみ配信なら優先度低いが、ストアで配信地域を絞らない場合は対応推奨 |
| app-ads.txt | 公開Webサイト（独自ドメイン推奨）に `app-ads.txt` を置くと収益化の信頼性が上がる |
| 広告枠の設計案 | バナー（ホーム/精算画面下部）＋ インタースティシャル（数ハンドごと）＋ リワード（チップ回復と相性◎）。**プレイ中（配置操作中）の全画面広告は体験を壊すので避ける** |
| 審査 | AdMobのアプリ審査は「ストア公開後」にストアリンクを紐付けて完了する流れ。公開前はテスト広告IDで実装 |

## 4. 法務・その他（日本の個人開発）

- **プライバシーポリシー必須**（広告SDKが広告IDを収集するため）。GitHub Pages / Notion公開ページでもOK。記載: 収集情報（広告ID）、利用目的（広告配信）、AdMobへのリンク、問い合わせ先
- **特定商取引法**: アプリ内課金をしないなら不要
- **賭博関連**: 実マネー・換金要素なし（アプリ内チップのみ）なら賭博に該当しない。リワード広告でチップ付与もOK
- **確定申告**: 広告収益が給与外所得20万円/年を超えたら申告（DMM勤務の給与所得者の場合）
- **商標**: 「OFCデュエル」は独自名称。元ブログ（boardgameblog.net）の「ターボ」名は使用しておらず商標リスクは低いが、ルール出典としてブログ著者への一声は引き続き推奨

## 5. コード側の作業状況

- [x] EAS（`eas init`）セットアップ済み — `app.json` に `projectId` 設定済み。`eas build` はExpoアカウントでログインしてから実行
- [x] アプリアイコン・スプラッシュ画像 — `assets/` に生成済み（icon.png / splash-icon.png / adaptive icon 一式）
- [x] `app.json`: bundleIdentifier `com.entrogix.ofcduel` / package 設定済み
- [x] `react-native-google-mobile-ads` 導入＋ATT実装済み
- [x] 本番 AdMob App ID・広告ユニットID（バナー/インタースティシャル）差し替え済み（`__DEV__` でテストID切替）
- [x] プライバシーポリシー作成済み（`store/privacy-policy.html`）— GitHub Pages 自動デプロイ設定済み
- [x] Render デプロイ設定（`render.yaml`）作成済み — サーバーURL: `wss://ofc-duel-server.onrender.com`
- [x] アプリバージョン 1.0.0 に更新
- [x] フィーチャーグラフィック（`store/feature-graphic.png` 1024×500）— 新ロゴで再生成（2026-06-20）
- [x] ストア用スクリーンショット（`store/screenshots/01〜04` 1290×2796 = iPhone 6.7"／Play兼用）— Web版から自動キャプチャ（2026-06-20）
- [ ] EAS Build 実行（`eas build -p android --profile production` / `-p ios`）— Expoアカウントでのログインが必要
- [ ] オンライン対戦サーバーを Render にデプロイ（GitHub push → Render ダッシュボードで接続）

## 広告の実装状況（2026-06-14 時点）

**実装済み**（コード側）:
- バナー広告: TOP画面の最下部（`src/ads/AdBanner.native.tsx`）
- 全画面動画広告（インタースティシャル）: 対戦終了 → ホーム遷移時に表示（`src/ads/interstitial.native.ts`）
- AdMob初期化＋iOSのATT許可要求: 起動時（`src/ads/init.native.ts`）
- 現在は **テスト用広告ユニットID（ライブラリの TestIds）** を使用。Web / Expo Go ではダミー表示（実広告なし、拡張子分割で安全に無効化）

**実装状況**:
- [x] `app.json` の `androidAppId` / `iosAppId` を本番 App ID に差し替え済み
- [x] `AdBanner.native.tsx` と `interstitial.native.ts` に本番ユニットIDを設定済み（`__DEV__` でテストID切替）
- [x] `store/app-ads.txt` に本番パブリッシャーID (`pub-1044199138394823`) を設定済み
- [ ] AdMob 管理画面でアプリとストアURLを紐付け（ストア公開**後**に実施）
- [ ] `app-ads.txt` を公開Webサイトのルートに設置（GitHub Pages デプロイ後）

## ストア審査の申告（データ安全性 / App Privacy）

広告SDK（AdMob）が識別子を扱うため、両ストアの申告で「データ収集あり」を選ぶ：

**Google Play「データ セーフティ」**:
- 位置情報（おおよそ）／アプリのアクティビティ／デバイスID = 収集・共有あり
- 目的: **広告またはマーケティング**
- データは転送時に暗号化（AdMobはHTTPS）。申告ガイド: https://support.google.com/admob/answer/9959358

**Apple「App のプライバシー」（栄養ラベル）**:
- Identifiers（デバイスID/IDFA）= **トラッキングに使用**、Usage Data = 使用
- 「トラッキング」に該当 → ATT実装済み（`NSUserTrackingUsageDescription` を app.json で設定済み）
- 申告ガイド: https://support.google.com/admob/answer/10787490

## 実機テストのやり方

### A. Expo Go（今すぐ・手軽・広告以外の全機能）
1. `cd packages/app && npx expo start`
2. スマホに「Expo Go」アプリを入れ、表示されたQRを読む（PCとスマホは同じWi-Fi）
3. CPU対戦・FL演出・音・D&D・UIなど**広告以外は全部テスト可能**
   - 広告はExpo Goでは自動でダミー表示（クラッシュしないようガード済み）
   - オンライン対戦を試すなら、別ターミナルで `packages/server` の `npm start` を起動し、
     アプリのサーバーURL欄に PCのLAN IP（例 `ws://192.168.1.10:8787`）を入力

### B. EAS development build（広告込みの完全テスト）
1. Expoアカウントを作成（無料）→ `npx eas-cli login`
2. `cd packages/app && npx expo install expo-dev-client`
3. `npx eas-cli build --profile development -p android`（または ios）
4. ビルド完了URLから実機にインストール → `npx expo start --dev-client`
   - これで**実広告（テストID）も含めて**実機確認できる
   - 所要: 初回ビルド10〜20分、Expoアカウントのログインが必要（あなたの作業）

## ストア審査の対策（法務・知的財産・ライセンス）

### 疑似ギャンブルの扱い（重要）
- 本作はチップ制で**実マネー・換金なし** → 「real money gaming」ではないので賭博ライセンスや法人アカウントは不要
- ただし Apple は「simulated gambling」を**17+レーティング**に分類する。IARC質問票では「シミュレートされたギャンブル: あり」と正直に回答する
- アプリ内に「チップに金銭的価値はなく換金・賭博はできません」と明記済み（クレジット画面）。審査ノートにも同旨を書くと安全
- 出典: [Apple 5.3 Gaming/Gambling](https://developer.apple.com/app-store/review/guidelines/#gaming-gambling-and-lotteries) / [Google Play ギャンブル](https://support.google.com/googleplay/android-developer/answer/13381106)

### 知的財産（IP）
- コード・UI・ロゴ・アイコンはすべて自作 → 著作権は制作者に帰属。クレジット画面に `© 2026 Entrogix` を明記済み
- トランプのスート記号（♠♥♦♣）・数字は一般的記号で著作権の対象外
- 「OFC（Open Face Chinese）」はゲームの一般名称。名称・出典について元ブログ（boardgameblog.net）著者へ一報を入れておくと安心
- 商標: 「OFCデュエル」で他社の登録商標と衝突しないか、出願前に J-PlatPat 等で軽く確認

### サードパーティライセンス（対応済み）
- 依存OSSは MIT 522 / ISC / BSD / Apache-2.0 等の**寛容ライセンスのみ**（GPL等のコピーレフト・配布制限なしを確認済み）
- MIT等は著作権表示の保持が条件 → アプリ内「クレジット/ライセンス」画面に主要パッケージと © を掲載済み
- 音源（Kenney / Joth）は CC0 で表記義務なしだが、クレジット画面に謝辞を掲載

### その他の審査必須項目（再掲）
- プライバシーポリシーURL（広告で識別子を扱うため必須）→ `store/privacy-policy.html` を公開
- データ安全性 / App Privacy 申告（広告の識別子・位置情報）→ 本書「ストア審査の申告」セクション参照
- iOS ATT（トラッキング許可）実装済み・文言設定済み
- サポート連絡先（問い合わせメール）→ クレジット画面とストア掲載に記載

## 問い合わせフォームの設定（リリース前）

- アプリ内「設定 → お問い合わせ」フォームは実装済み。送信先は `src/config.ts` の `CONTACT_ENDPOINT`
- [ ] Formspree / Google Apps Script 等でJSON受信エンドポイントを作り、`CONTACT_ENDPOINT` に設定
- 未設定のままだとメールアプリ（mailto: `CONTACT_EMAIL`）が開く仕様。ストア審査・運用上はWebエンドポイントでアプリ内完結が望ましい

## 費用まとめ

| 項目 | 金額 |
|---|---|
| Google Play | $25（初回のみ） |
| Apple | $99/年 |
| AdMob | 無料 |
| EAS Build | 無料枠あり（足りなければ$19/月〜） |
| サーバー（オンライン対戦） | Render無料枠〜$7/月程度 |

**初年度合計: 約2万円〜**
