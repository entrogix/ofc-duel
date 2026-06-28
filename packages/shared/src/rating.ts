// レート（ランク戦）の純ロジック。依存ゼロ・サーバー/アプリ両方から参照する。
//
// 設計:
// - マルチプレイヤーEloを「ペア分解」で扱う。各ペア(A,B)について最終チップが多い方を
//   勝ち(1)/少ない方を負け(0)/同じを引分(0.5)とし、Eloの期待値との差を反映する。
// - 変動は「人間どうしのペア」だけ。ボット（uid空）相手の勝敗はレートに一切影響させない
//   （過疎時にボットを狩ってレートを盛る抜け道を塞ぐ）。
// - K値はテーブルの人間数で正規化し、人数が増えても1試合の変動幅が暴れないようにする。

export const DEFAULT_RATING = 1000;
export const RATING_FLOOR = 100;
const K = 32;

export interface RatingPlayer {
  uid: string; // 永続ユーザーID。ボットや未ログインは空文字
  rating: number; // 対局前のレート
  chips: number; // 対局終了時のチップ（最終結果）
}

export interface RatingChange {
  uid: string;
  before: number;
  after: number;
  delta: number;
}

function expectedScore(self: number, opp: number): number {
  return 1 / (1 + Math.pow(10, (opp - self) / 400));
}

// 対局結果から、人間プレイヤーごとのレート変動を算出する。
// 戻り値は uid をキーにした変動マップ（人間のみ。ボットは含まない）。
export function computeRatingChanges(players: RatingPlayer[]): Map<string, RatingChange> {
  const humans = players.filter((p) => p.uid !== '');
  const result = new Map<string, RatingChange>();
  if (humans.length < 2) return result; // 人間が1人以下なら勝負が成立しない＝変動なし

  const effectiveK = K / (humans.length - 1);
  const deltas = new Map<string, number>();
  for (const h of humans) deltas.set(h.uid, 0);

  for (let i = 0; i < humans.length; i++) {
    for (let j = i + 1; j < humans.length; j++) {
      const a = humans[i];
      const b = humans[j];
      const sa = a.chips > b.chips ? 1 : a.chips < b.chips ? 0 : 0.5;
      const ea = expectedScore(a.rating, b.rating);
      deltas.set(a.uid, (deltas.get(a.uid) ?? 0) + effectiveK * (sa - ea));
      deltas.set(b.uid, (deltas.get(b.uid) ?? 0) + effectiveK * ((1 - sa) - (1 - ea)));
    }
  }

  for (const h of humans) {
    const raw = Math.round(deltas.get(h.uid) ?? 0);
    const after = Math.max(RATING_FLOOR, h.rating + raw);
    result.set(h.uid, { uid: h.uid, before: h.rating, after, delta: after - h.rating });
  }
  return result;
}

// 人間1人 vs 較正ボット1体のレート変動（人間のみ更新）。
// ボットは uid を持たないが「割当レート」を持ち、その rating に対し通常のEloで人間を動かす。
// ボットの強度はこの rating に較正されている（ai.skillForRating）ため、期待勝率≒0.5＝
// 期待変動0となり、ボット狩りでのレート水増しは成立しない。ボット自身は永続化しない。
export function computeRatingVsBot(
  human: { uid: string; rating: number; chips: number },
  bot: { rating: number; chips: number },
): RatingChange | null {
  if (!human.uid) return null;
  const sa = human.chips > bot.chips ? 1 : human.chips < bot.chips ? 0 : 0.5;
  const ea = expectedScore(human.rating, bot.rating);
  const raw = Math.round(K * (sa - ea));
  const after = Math.max(RATING_FLOOR, human.rating + raw);
  return { uid: human.uid, before: human.rating, after, delta: after - human.rating };
}

export interface Rank {
  key: string;
  label: string;
  min: number;
}

// 下から順に。初期1000はシルバー（上下に伸びしろを持たせる）。
export const RANKS: Rank[] = [
  { key: 'bronze', label: 'ブロンズ', min: 0 },
  { key: 'silver', label: 'シルバー', min: 800 },
  { key: 'gold', label: 'ゴールド', min: 1100 },
  { key: 'platinum', label: 'プラチナ', min: 1400 },
  { key: 'diamond', label: 'ダイヤ', min: 1700 },
  { key: 'master', label: 'マスター', min: 2000 },
];

export function rankFor(rating: number): Rank {
  let cur = RANKS[0];
  for (const r of RANKS) {
    if (rating >= r.min) cur = r;
  }
  return cur;
}
