// プレイヤー/ボットのデフォルト表示名を生成する。
// 全員が「あなた」だと対戦相手と見分けがつかないため、seed から安定的に
// ユニークな名前（形容詞 + 役割 + 番号）を作る。同じ seed なら毎回同じ名前になる。
//
// アプリ: UID を seed に渡す（端末ごとに決定的・設定で変更可）。
// サーバー: ボット着席時にランダム seed を渡す（人間と同じ命名規則で見分けがつかないようにする）。

const ADJ = [
  '不敵な', '華麗な', '豪快な', '沈着な', '果敢な', '冷静な', '大胆な', '慎重な',
  '神速の', '鉄壁の', '野生の', '孤高の', '百戦の', '一閃の', '黄金の', '無敵の',
];

const NOUN = [
  'シャーク', 'ディーラー', 'ジョーカー', 'エース', 'クイーン', 'キング', 'ジャック', 'ハスラー',
  'ルーキー', 'マエストロ', 'ファントム', 'ナイト', 'ウルフ', 'ドラゴン', 'タイガー', 'フォックス',
];

// 文字列を 32bit のハッシュへ（FNV-1a）。乱数ではなく seed から決定的に決めるため。
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// seed から「不敵なシャーク47」のような安定したユニーク名を作る。最大11文字（入力上限12に収まる）。
export function generateDefaultName(seed: string): string {
  const h = hashStr(seed || String(Math.random()));
  const adj = ADJ[h % ADJ.length];
  const noun = NOUN[(h >>> 8) % NOUN.length];
  const num = (h >>> 16) % 100; // 0..99
  return `${adj}${noun}${num}`;
}

// ボット用：ユーザーと同じ命名規則でランダムな名前を1つ作る（永続UIDを持たないため毎回ランダム）。
export function randomBotName(rng: () => number = Math.random): string {
  return generateDefaultName(`bot-${Math.floor(rng() * 1e9)}-${Math.floor(rng() * 1e9)}`);
}
