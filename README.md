# OFCターボ — オープンフェイス・チャイニーズポーカー アプリ

ボードゲームブログの [OFCターボ](http://boardgameblog.net/2022/06/02/ocpt/) をスマホアプリ化したもの。
React Native / Expo 製。CPU対戦とオンライン対戦（ルームコード方式）に対応。

## 構成

```
packages/
├── shared/   # ゲームロジック（純TS・依存ゼロ）: 役判定/採点/FL/エンジン/CPU AI
├── server/   # オンライン対戦サーバー（Node.js + ws、サーバー権威）
└── app/      # Expoアプリ（ホーム/CPU対戦/オンライン/ルール）
```

詳細仕様: [docs/requirements.md](docs/requirements.md)

## セットアップ

```bash
cd packages/shared && npm install
cd ../server && npm install
cd ../app && npm install
```

## 起動

```bash
# アプリ（Expo）。実機は Expo Go アプリでQRコードを読む
cd packages/app
npx expo start          # iOS/Android
npx expo start --web    # ブラウザで確認

# オンライン対戦サーバー（オンライン対戦するときだけ必要）
cd packages/server
npm start               # ws://localhost:8787
```

スマホ実機からオンライン対戦する場合は、サーバーを起動したPCのLAN IPを
アプリの「サーバーURL」欄に入力する（例: `ws://192.168.1.10:8787`）。

## テスト

```bash
cd packages/shared
npm test                # 役判定・採点・エンジン・AI・同時公開ルールの14テスト

# サーバーのスモークテスト（別ターミナルで npm start しておく）
cd packages/server
npx tsx src/smoke_test.ts
```

## 遊び方（アプリ内「ルールを見る」にも記載）

- 13枚を フロント3 / ミドル5 / バック5 に配置。強さは フロント ≦ ミドル ≦ バック 必須
- 5枚 → 4枚 → 4枚 の3回に分けて配置し、そのたび全員同時公開
- フロントQQ以上でファンタジーランド（次ハンド13枚一括配置）
- 初期チップ50点。全員2回ずつディーラーを務めるか誰かが破産したら終了
