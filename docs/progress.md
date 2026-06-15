# ofc-turbo 進捗

## 直近の意思決定

- 2026-06-12: プロジェクト開始。要件は [requirements.md](requirements.md) 参照
  - フルゲーム / CPU対戦＋オンライン対戦 / 通常OFCターボ(5-4-4) / React Native + Expo
  - オンラインはルームコード方式（4文字）、Node.js + ws のサーバー権威
  - モノレポ: shared（純TSロジック）を app / server が相対パス参照（Metroは watchFolders で解決）
- 採点の設計判断: バースト者は「6点＋相手のロイヤリティ」を各相手に支払う（ブログは6点のみ明記。一般的なOFCルールを採用し requirements.md に記録）
- 同時公開ルールはエンジンの `revealBoard`（前ストリートまでのスナップショット）で実装。`board` は本人とサーバーのみ参照

## 完了

- [x] 要件確認（ユーザー回答済み）と要件定義ドキュメント
- [x] shared: カード/役判定/ロイヤリティ/採点/エンジン/FL/ビュー秘匿/CPU AI（テスト14本パス）
- [x] CPU AI: 全列挙＋評価関数。バースト率 <35%（テストで担保）
- [x] server: ルーム作成/参加/開始/配置/次ハンド/切断時のゲーム中断。スモークテストで2人1ゲーム完走
- [x] app: ホーム/CPU対戦/オンライン/ルール画面。Expo Web で1ハンド完走を実機検証
  - 精算計算の整合性（バースト-17 = 6+3 と 6+2 の支払い等）をブラウザ上で確認済み

- [x] 2026-06-13 ユーザー初回フィードバック対応
  - スマホUI: 全画面を幅480pxのフォン枠に統一、確定ボタン48px+、カード拡大(50×70)、退出をヘッダーへ、375×812で縦スクロールなしを確認
  - アニメーション: 配札スタッガー(FadeSlideIn)、配置ポップ(PopIn)、ストリート公開フェード、精算オーバーレイのスライドイン、選択カードのグロー、押下フィードバック
  - 精算詳細: 「あなたの収支」サマリー＋「ポイントの動き」ペア別内訳（行ごとの○×−、スクープ倍額、役ボーナス差引、バースト支払い内訳）を追加
  - RN 0.85 の shadow* 非推奨警告を boxShadow へ移行

- [x] 2026-06-13 ユーザーフィードバック第2弾対応
  - 配置途中のリアルタイム役表示（`partialHandLabel` を shared に追加。確定+仮置きで判定、行ラベル下に表示）
  - 精算画面のスクロール不能バグ修正（Webのflexは `minHeight:0` がないと縮まない。%maxHeightも廃止しflexShrinkに）
  - 余白圧縮: カード54×76に拡大、board は space-evenly、各パディング削減。375×812でスクロールなし
  - BGM/SE: Kenney Casino Audio(CC0) を m4a 変換（iOS互換）＋ Joth「8bit Bossa」(CC0) をBGMに。expo-audio で実装、🔊ミュートトグル付き。クレジットは assets/sounds/CREDITS.md
  - D&D配置: PanResponder 自作 DraggableCard（タップ配置と併存）。トレイはドラッグのはみ出しを許すため ScrollView→折返しViewに変更
  - 検証メモ: **previewブラウザはタブ非表示で rAF が止まり Animated が進まない**（スクショもタイムアウト）。アニメ位置の検証は stuck transform を補正して判断する

- [x] 2026-06-13 ユーザーフィードバック第3弾対応
  - boardの行間を元の詰めた配置に戻す（space-evenly廃止）
  - タイトル画面（スタートページ）追加。初回タップがWeb音声制限解除を兼ねる
  - 退出確認モーダル（自前ConfirmModal。RN AlertはWeb非対応のため）
  - 役完成演出 HandFx（tier1〜4で文字サイズ・色・表示時間・SEが変化）
  - ゲーム終了演出（紙吹雪Confetti＋勝者バナー。自分が勝つと紙吹雪増量）
  - 公開準備ドキュメント [release-checklist.md](release-checklist.md) 作成（ストア登録・AdMob・法務）

- [x] 2026-06-13 ユーザーフィードバック第4弾＋FL演出＋デザイン刷新＋ストア準備（夜間自走）
  - 役演出の判定バグ修正: DraggableCardのPanResponderが初回クロージャを掴み続け黄色カードが判定に入らない → onDrop/onDragStartをref経由で最新参照に
  - 黄色カードのドラッグ移動（行→行の直接移動、行外ドロップでトレイへ）。ドラッグ開始時に行座標を再計測して堅牢化
  - 精算画面: 「あなたの対戦」（詳細・緑アクセント）と「その他の対戦」（1行・控えめ）に分離
  - 4人プレイ対応: 相手3人時は microサイズカードで合計310px に収まる（はみ出しなし確認済み）
  - 残りハンド数表示（`view.remainingHands`、FL延長は含まない）
  - FL演出: カットイン（FantasyCutIn、斜め帯+1.7秒）、フィーバーBGM切替（Joth「Porkymon Battle Theme」CC0）、紫のフィーバー配色、FL継続条件バー（✓のライブ判定付き）
  - デザイン: 4色デッキ（♠黒♥赤♦青♣緑）、Logoコンポーネント（タイトル/ホーム）、アプリアイコン一式をsharpで生成（icon/adaptive/monochrome/favicon/splash）
  - ストア準備: app.json（bundleId/package = com.entrogix.ofcturbo、splash設定）、eas.json、docs/privacy-policy.md、docs/store-listing.md

- [x] 2026-06-13 ユーザーフィードバック第5弾対応
  - ルール画面を図解付きに全面リライト（正しい例/バースト例のボード図、流れ・採点の具体例、役一覧を統合）
  - プレイ中の役一覧: ヘッダー❓ボタン → HandGuideModal（例カード・ロイヤリティ・フロント特例つき、弱い順）
  - オンライン対戦の実現方法を [online-deployment.md](online-deployment.md) に整理（LAN/Render無料枠/本格運用の3段階）
  - server: デプロイに備え tsx を dependencies へ移動

- [x] 2026-06-14 ランダムマッチ（Step2）＋過疎対策（Step3）実装
  - server全面リライト: Seatベース、ルームコード対戦とランダムマッチを統合。HTTPサーバー内包（Renderヘルスチェック対応）
  - マッチングキュー（join_random/cancel_random、最大4人 or 15秒）、CPU補充（BOT表示）、配置制限60秒＋CPU代行、45秒猶予のトークン再接続、精算後8秒自動進行
  - タイミングは環境変数化（OFC_MATCH_FILL_MS等）。テスト: matchmaking_test.ts（4シナリオ）＋既存smoke_test（ルームコード回帰）パス
  - client: OnlineClientに joinRandom/cancelRandom/reconnect/onMatchmaking、OnlineScreenにランダムマッチ導線・待機画面・自動再接続、GameScreenに⏱制限時間バッジ
  - Webプレビューで実接続確認: ソロ→ボット補充→制限時間→配置→精算→自動次ハンドの全フロー動作
  - Step1（Renderデプロイ）はユーザー作業。online-deployment.md / random-matchmaking.md 参照

- [x] 2026-06-14 フィードバック第6弾（UI刷新＋広告）
  - 配置制限を60秒→30秒（server `OFC_PLACE_LIMIT_MS` デフォルト変更）
  - 対戦画面ヘッダーを3段リッチパネル化（操作行／名前+💰チップ／ストリートドット+残ハンド+⏱）。盤面が下に詰まり中央の空白解消（375×812ではみ出しなし確認）
  - TOP画面をユースケース別カードに刷新（🤖CPU対戦＝人数選択モーダル / 🌍ランダムマッチ / 👥フレンド対戦）。人数選択はCPU対戦内に格納。OnlineScreenに initialMode追加
  - 広告: react-native-google-mobile-ads + expo-tracking-transparency 導入。TOP最下部バナー＋対戦終了時インタースティシャル動画。拡張子分割（.native / デフォルト）でWeb/Expo Goはダミー、tscも通る。テストIDで実装（本番ID差し替えはrelease-checklist）
  - ストア審査情報: privacy-policy.md 広告セクション有効化、release-checklist.md にデータ安全性/App Privacy申告ガイド＋本番ID差し替えTODO
  - Webプレビューで検証: ホーム3カード・バナー枠・人数モーダル・新ヘッダー・はみ出しなしを確認

- [x] 2026-06-14 ストア提出物一式を `store/` に集約
  - feature-graphic.png（1024×500、make-feature-graphic.mjsで生成）/ privacy-policy.html（公開用）/ app-ads.txt（pub-IDひな形）/ README.md（提出物索引・あなたの作業一覧）/ screenshots/README.md（撮影手順）
  - アイコン・スプラッシュ・eas.json・掲載文(store-listing.md)・審査申告ガイド(release-checklist.md)は既存。残るユーザー作業: ストアアカウント登録・AdMob本番ID・実機ビルド・スクショ撮影・クローズドテスト12人

- [x] 2026-06-14 フィードバック第7弾（オンラインUX・レート土台）
  - 配置制限30秒（前回）、TOP画面にBGM/SE、ランダムマッチからフレンド導線削除、サーバーURL欄削除（config.ts定数化）
  - ランダムマッチにカジュアル/レート選択（レートはComing Soon無効）、フレンド合言葉を数字4桁に統一（サーバーmakeCodeも数字化、入力number-pad）
  - レート対戦の土台: 永続ユーザーID（identity.ts, AsyncStorage）。名前変更で追えなくならないようUIDで本人管理。サーバーSeatにuid保存、join系でuid/matchType送受信
  - SDK56→54へダウングレード（iOS Expo GoがSDK54対応のため）。広告は遅延require化でExpo Goクラッシュ回避（adsAvailable=Constants.executionEnvironment判定）
- [x] 2026-06-14 公開向け著作権・審査対策
  - アプリ内クレジット/ライセンス画面（CreditsScreen）: ©2026 Entrogix、賭博でない旨の免責、音源CC0謝辞、OSS主要パッケージとライセンス表記。タイトルに©、ホームに導線
  - 依存OSSは全て寛容ライセンス（MIT522/ISC/BSD/Apache-2.0、GPL等なし）をlicense-checkerで確認
  - release-checklist.md に審査対策セクション追加（疑似ギャンブル17+・IP・OSSライセンス・ATT）

- [x] 2026-06-14 ルール最適化の設計確定（ADR-0001 Accepted）※実装は次タスク
  - 競合調査: 既存OFCアプリは英語・ガチ・パイナップル中心。日本語カジュアルOFCは空き地。ルールは著作権対象外＝名称変更＋クレジットで丸パクリ回避は足りる
  - 確定: ①全対戦ヘッズアップ(2人)固定（3〜4人廃止）②毎ストリート1枚捨て（6/5/5配り→5/4/4置き）③裏向き同時公開維持④FL=一律14枚配り1枚捨て
  - 根拠シミュレーション（packages/shared/sim/）: completion_sim=捨て枚数別の完成率（1枚捨てが運/実力バランス最良）。fl_continuation_sim=FL継続率（14枚で15%・平均1.18ハンド＝報酬十分かつ非runaway）
  - 52枚デッキ制約: 捨てありは1人16枚→ヘッズアップ32枚でのみ成立（3人48/4人64破綻）。この制約がヘッズアップ固定と整合
  - 実装補助: chooseCpuPlacementWithDiscard を ai.ts に追加済み（捨て対応CPU。本実装で流用）
  - 詳細: docs/adr/0001-rule-optimization-for-ranked.md
  - 次タスク: エンジンの捨て対応（dealt≠配置枚数）・FL14枚化・CPU/UI/ルール画面/テスト改修

- [x] 2026-06-14 レート/ランク戦を本実装（「対戦でのやり込み」の核。ベンチマーク=動物タワーバトル）
  - shared/rating.ts: マルチプレイヤーElo（ペア分解）。最終チップで各ペア勝敗、人間どうしのみ変動（ボット狩り防止）、K値を人間数で正規化。ランク=ブロンズ〜マスター（初期1000=シルバー）。テスト8本追加（計22）
  - server/ratingStore.ts: UIDキーのJSON永続化。⚠️本番Renderは揮発ディスク→OFC_RATING_FILEに永続ボリューム or 外部DB差し替え前提（薄IFに分離済み）
  - server/index.ts: ランダムマッチに matchType でカジュアル/レート卓を分離（混ぜない）。game_over時にレート精算→各人へ before/after/delta/rank を通知。`stats` 問い合わせ追加。matchmaking_test に rated/casual の2シナリオ追加（計6）
  - app: OnlineClientに onRating/onStats/requestStats。OnlineScreenのレート対戦を有効化（Coming Soon撤廃）＋現在レート/ランク表示（短命接続でstats取得）。ResultOverlayに終局レート変動バナー（GameScreen経由でratingResult受け渡し）
  - 既知の限界(MVP): マッチングは同種プール内で先着（レート近接マッチではない）。人間1人＋ボットのレート卓は変動0。スキルベースマッチ・シーズン・報酬は未実装
  - 検証: shared 22/22・server matchmaking6/6+smoke・app tsc 全パス
  - 戦略メモ: 競合（英語ガチOFC）とは別レーン。日本語カジュアル×対戦やり込みで勝負。差別化はルール変更でなくポジショニング＋レート＋演出＋シェア

- [x] 2026-06-14 集客: アプリ内バイラルループ＋ASO最適化（新規依存ゼロ）
  - 招待リンク: app.json に `scheme: "ofcturbo"` 追加。RN組み込み `Linking` で `ofcturbo://join?code=1234` を受け、フレンド参加へ直行＋自動入室（App.tsx）。Info.plistにスキーム登録済（prebuild同期確認）
  - 共有: ロビーに「📨 友達を招待」ボタン。RN組み込み `Share` で合言葉＋リンクをLINE/X等に送れる（src/invite.ts）。1人が3人を呼ぶ獲得ループの起点
  - 受け側: OnlineScreen に `initialJoinCode` 追加、`connect('join',{code})` で明示コード参加。autoJoinedRefで1回のみ
  - ASO（store-listing.md）: App Storeサブタイトル新設（検索加重大）、キーワードを名称重複排除で再設計、ニッチ第一級語（オープンフェイス/チャイニーズポーカー/OFC/積みポーカー）で1位狙う戦略メモ追加。説明文を4桁合言葉＋招待リンク＋ランダムマッチに更新
  - 検証: shared 14/14・app `tsc --noEmit` パス。実機での共有シート/リンク起動はビルド後に要確認
  - 集客戦略の全体像（バイラル/コミュニティ/ASO/コンテンツ）はチャット参照。未着手: 元ブログ連絡文・ショート動画台本
  - 課金判断の土台: AdMob損益分岐シミュレーション実施（継続DAU≈48人で$99/年回収。AdMob入金は約$100到達後の点に注意）

- [x] 2026-06-14 1枚捨て＋ヘッズアップ実装（ADR-0001を本実装）
  - engine: 6/5/5配り→5/4/4置き（各ストリート1枚捨て・計3枚捨て）、FL14枚→13置き1捨て、2人固定。PlayerStateにdiscards/revealDiscards、submitは「配置しなかった残り1枚を自動で捨て札」に
  - view: SelfView.needPlace（=dealt-1）でクライアントの配置枚数をサーバー基準に統一（streetズレ防止）、自分/相手のdiscards公開
  - CPU: chooseCpuPlacementWithDiscard を server/LocalGame/testで使用
  - UI: 残り1枚に赤枠＋「捨て」タグ、確定はneedPlace枚で有効、自分の捨て札「🗑捨て札」行、相手の捨て札はOpponentBoardに表示。CPU人数選択モーダル廃止（1対1固定）、各画面の人数表記を1対1に
  - server: マッチング2人固定、ルーム上限2、CPU代行を捨て版に
  - テスト: shared 23件パス（6-5-5・3枚捨て・捨て札公開・ヘッズアップ拒否）、matchmaking 6シナリオパス、Webプレビューで配置→捨て→精算を実走確認

- [x] 2026-06-14 設定画面＋規定ハンド数
  - 規定ハンド数で終了（EngineOptions.targetHands、デフォルト10。1戦≒5分）。view.remainingHandsも連動
  - settings.ts: AsyncStorage永続化（bgmOn/seOn/reduceMotion/playerName）。audio.tsはsettings参照に（BGM/効果音 個別ON/OFF）
  - SettingsScreen: サウンド(BGM/効果音)・演出を減らす(reduceMotion)・名前・あなたのID(永続UID先頭8桁・引き継ぎ用)。ホーム下部「⚙️設定」から
  - anim.tsx: reduceMotion時はアニメをスキップ（即最終状態）
  - GameScreenの🔊ボタンも設定bgmOnと同期。名前はホーム入力⇔設定で双方向に永続化
  - Webプレビューで設定画面表示・10ハンド表示を確認、エラーなし

- [x] 2026-06-14 戦績・ランキング画面＋ホーム整理
  - ホーム: 名前入力欄を削除（設定に集約。各モードは getSettings().playerName を使用）。クレジットを小さくフッター上に移動。「📊 戦績・ランキング」導線追加
  - server: ratingStore に getTopPlayers/getRank、'ranking' ハンドラ（TOP20＋自分の順位）。'stats' は既存
  - client: OnlineClient に RankingInfo/onRanking/requestRanking
  - StatsScreen: サーバー接続して自分の戦績（ランク/レート/対戦/勝利/勝率/順位）＋レートランキングTOP20を表示。オフライン時は案内
  - Webプレビューで表示・サーバー接続・エラーなしを確認。server/app tsc クリーン

- [x] 2026-06-14 マッチング見直し・戦績履歴・点検
  - ランダムマッチを**人間同士のみ**に（CPU補充廃止）。casual/rated別キューで2人揃ったら即マッチ、不在は待機継続。試合中のAFK/切断CPU代行は救済として維持
  - ホーム3モードカードを全てaccent（金枠）に統一
  - 対戦履歴: ratingStoreにMatchRecord（直近20・勝敗/相手/delta/レート/モード）、stats応答に同梱、StatsScreenに「最近の対戦」表示
  - ランキング更新タイミング等を [matchmaking-and-ranking.md](matchmaking-and-ranking.md) に設計記載（リアルタイム反映・プル取得・全期間ラダー・永続化課題・将来案）
  - 点検: store-listingの古い人数記述（2〜4人/CPU1〜3/CPU補充）を1対1へ修正。server: targetHands env可変化、未使用のaddBot/newBotId/queueTimer/MATCH_FILL削除
  - テスト: matchmaking 6シナリオ（ソロ待機・人間2人・AFK・再接続・レート・casual）パス、Webで全UI確認・エラーなし

- [x] 2026-06-14 あそびかた修正＋問い合わせフォーム
  - RulesScreenを現仕様に修正（6/5/5・1枚捨て・1対1・FL14枚・10ハンド・対戦モード説明）
  - ContactScreen（種類/内容/返信先メール任意）。設定→サポート→お問い合わせから。config.CONTACT_ENDPOINT にPOST、未設定時はmailtoフォールバック。バージョン・匿名UIDを同送

- [x] 2026-06-14 アプリ名称変更（ターボ→デュエル）
  - 正式名称「オープンフェイス・チャイニーズポーカー・デュエル」、短縮ブランド「OFCデュエル / OFC DUEL」
  - app.json: name=OFCデュエル / slug=ofc-duel / scheme=ofcduel / bundleId・package=com.entrogix.ofcduel（未公開のうちに識別子も変更）
  - Logo(TURBO→DUEL・サブ正式名)、アイコン/フィーチャーグラフィック再生成、invite(scheme・文言)、ContactScreen件名、CreditsScreen作品説明、server log、store-listing名称
  - ディレクトリ products/ofc-turbo と内部パッケージ @ofc/* は内部識別子として据え置き
  - tsc/プレビュー確認・エラーなし。ADR-0001の残課題「名称」を解消

## 作業中・未着手

- [ ] 実機iOSビルド（無料Apple ID + Xcode方式）— 地ならし済み、残りはユーザー作業
  - 2026-06-14: ベースライン確認（shared 14/14・server smoke/matchmaking 全パス）
  - app: `npm install`済 / `tsc --noEmit`パス / `expo prebuild --platform ios`で `ios/` 生成 / CocoaPods(brew)導入し `pod install`完了（81 pods、`ios/OFC.xcworkspace`生成）
  - bundle id = com.entrogix.ofcturbo。`ios/`は.gitignore対象（CNG/オンデマンドprebuild運用）
  - 残: ①フルXcode導入(`xcode-select -s`)②iPhone USB接続+デベロッパモード③`npx expo run:ios --device`④Xcodeで自分のApple IDをTeam設定⑤端末で開発者を信頼。無料IDは7日失効
  - 注意: pod install時 `Unexpected XCode version string ''` 警告＝現状CLTのみのため。フルXcode導入後は解消
  - prebuildがpackage.jsonのios/androidスクリプトを`expo run:*`に書換え（未コミット）。Expo Go運用に戻すなら戻す
- [ ] 実機（Expo Go / iOS/Android）での動作確認 ※Webでは確認済み
- [ ] FLカットイン・フィーバーBGMの実プレイ確認（FL突入が必要なため未検証。ロジックはテスト済み）
- [ ] ストアアカウント作成（Google Play $25 / Apple $99）→ docs/release-checklist.md
- [ ] プライバシーポリシーのWeb公開（docs/privacy-policy.md をGitHub Pages等へ）
- [ ] オンライン対戦の再接続対応（v1は切断＝ゲーム中断）
- [ ] サーバーの公開デプロイ（現状はLAN内のみ。Render/Fly.io等を検討）
- [ ] レート戦の発展: スキルベースマッチ（レート近接）・シーズン制・ランク報酬・リーダーボード（MVPは同種プール先着のみ）
- [ ] レート永続化の本番対応（Render揮発ディスク→永続ボリューム or 外部DB。ratingStoreの薄IFを差し替え）
- [ ] シェア/実況の素: 結果シェア画像（バースト/ロイヤル/逆転）・リプレイ（動物タワーバトル型の無料拡散エンジン）
- [ ] CPU AIの強化（現状はヒューリスティック。残り山札を考慮した確率評価など）
- [ ] Pineapple（3人版）対応
- [ ] 効果音・アニメーション（カード配置、FL突入演出）
- [ ] ストアリリース準備（アイコン、EAS Build）

## 既知の注意点

- 同一evalやテストでエンジンを直接叩く場合、配置は「配られた全カードを過不足なく」が必須
- クライアントは state ブロードキャストのたびに自動配置しないこと（hand:street キーで二重送信ガード。smoke_test.ts 参照）
- preview（Expo Web）のブラウザはWebSocketで localhost:8787 に出られないため、オンラインの結合確認は server/src/smoke_test.ts で行う
