// 対戦サーバーのURL。
// 開発中（実機テスト）はこのPCのLAN IPを指定する。LANが変わったらここを書き換える。
// 本番リリース時はデプロイ先（wss://...）に変更する（online-deployment.md 参照）。
export const SERVER_URL = 'wss://ofc-duel-server.onrender.com';

// 問い合わせフォームの送信先（POST先のHTTPS URL）。
// Formspree や Google Apps Script など、JSONを受けるエンドポイントを設定する。
// 空のままなら、送信時にメールアプリ（mailto）へフォールバックする。
export const CONTACT_ENDPOINT = '';
export const CONTACT_EMAIL = 'sou0430@gmail.com';
