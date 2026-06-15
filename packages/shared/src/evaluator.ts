import { Card } from './cards';

// 役カテゴリ（3枚役・5枚役で共通スケール。フロントは 0/1/3 のみ取り得る）
export enum HandCat {
  High = 0,
  Pair = 1,
  TwoPair = 2,
  Trips = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  Quads = 7,
  StraightFlush = 8,
}

export interface HandValue {
  cat: HandCat;
  tiebreak: number[]; // 大きい順に比較
}

export const CAT_LABELS: Record<HandCat, string> = {
  [HandCat.High]: 'ハイカード',
  [HandCat.Pair]: 'ワンペア',
  [HandCat.TwoPair]: 'ツーペア',
  [HandCat.Trips]: 'スリーカード',
  [HandCat.Straight]: 'ストレート',
  [HandCat.Flush]: 'フラッシュ',
  [HandCat.FullHouse]: 'フルハウス',
  [HandCat.Quads]: 'フォーカード',
  [HandCat.StraightFlush]: 'ストレートフラッシュ',
};

export function handLabel(v: HandValue, isBack5 = false): string {
  if (v.cat === HandCat.StraightFlush && v.tiebreak[0] === 14) return 'ロイヤルフラッシュ';
  return CAT_LABELS[v.cat];
}

function rankCounts(cards: Card[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const c of cards) m.set(c.rank, (m.get(c.rank) ?? 0) + 1);
  return m;
}

// 重複なしランク配列からストレートのハイカードを返す（A-5は5）。なければ0
function straightHigh(ranks: number[]): number {
  const uniq = [...new Set(ranks)].sort((a, b) => b - a);
  if (uniq.length < 5) return 0;
  for (let i = 0; i + 4 < uniq.length; i++) {
    if (uniq[i] - uniq[i + 4] === 4) return uniq[i];
  }
  // wheel: A,5,4,3,2
  if (uniq.includes(14) && uniq.includes(5) && uniq.includes(4) && uniq.includes(3) && uniq.includes(2)) return 5;
  return 0;
}

// グループ（同数カード）をカウント降順→ランク降順で並べた tiebreak を作る
function groupTiebreak(counts: Map<number, number>): { groups: [number, number][]; tiebreak: number[] } {
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]) as [number, number][];
  const tiebreak: number[] = [];
  for (const [rank, count] of groups) for (let i = 0; i < count; i++) tiebreak.push(rank);
  return { groups, tiebreak };
}

export function evaluate5(cards: Card[]): HandValue {
  if (cards.length !== 5) throw new Error('evaluate5 requires 5 cards');
  const counts = rankCounts(cards);
  const { groups } = groupTiebreak(counts);
  const isFlush = cards.every((c) => c.suit === cards[0].suit);
  const sHigh = straightHigh(cards.map((c) => c.rank));

  if (isFlush && sHigh) return { cat: HandCat.StraightFlush, tiebreak: [sHigh] };
  if (groups[0][1] === 4) return { cat: HandCat.Quads, tiebreak: [groups[0][0], groups[1][0]] };
  if (groups[0][1] === 3 && groups[1][1] === 2)
    return { cat: HandCat.FullHouse, tiebreak: [groups[0][0], groups[1][0]] };
  if (isFlush)
    return { cat: HandCat.Flush, tiebreak: cards.map((c) => c.rank).sort((a, b) => b - a) };
  if (sHigh) return { cat: HandCat.Straight, tiebreak: [sHigh] };
  if (groups[0][1] === 3)
    return { cat: HandCat.Trips, tiebreak: [groups[0][0], groups[1][0], groups[2][0]] };
  if (groups[0][1] === 2 && groups[1][1] === 2)
    return { cat: HandCat.TwoPair, tiebreak: [groups[0][0], groups[1][0], groups[2][0]] };
  if (groups[0][1] === 2)
    return { cat: HandCat.Pair, tiebreak: [groups[0][0], groups[1][0], groups[2][0], groups[3][0]] };
  return { cat: HandCat.High, tiebreak: cards.map((c) => c.rank).sort((a, b) => b - a) };
}

// フロント3枚: ハイカード/ワンペア/スリーカードのみ（ストレート・フラッシュなし）
export function evaluate3(cards: Card[]): HandValue {
  if (cards.length !== 3) throw new Error('evaluate3 requires 3 cards');
  const counts = rankCounts(cards);
  const { groups } = groupTiebreak(counts);
  if (groups[0][1] === 3) return { cat: HandCat.Trips, tiebreak: [groups[0][0]] };
  if (groups[0][1] === 2) return { cat: HandCat.Pair, tiebreak: [groups[0][0], groups[1][0]] };
  return { cat: HandCat.High, tiebreak: cards.map((c) => c.rank).sort((a, b) => b - a) };
}

// 配置途中の行でも「現時点でできている役」の名前を返す（ドロー表示はしない）
// 完成行は evaluate3/evaluate5、未完成は同ランクのグループのみで判定
export function partialHandLabel(cards: Card[], capacity: number): string {
  if (cards.length === 0) return '';
  if (cards.length === capacity) {
    const v = capacity === 3 ? evaluate3(cards) : evaluate5(cards);
    if (v.cat === HandCat.StraightFlush && v.tiebreak[0] === 14) return 'ロイヤルフラッシュ';
    return CAT_LABELS[v.cat];
  }
  const counts = rankCounts(cards);
  const { groups } = groupTiebreak(counts);
  if (groups[0][1] === 4) return 'フォーカード';
  if (groups[0][1] === 3 && groups.length > 1 && groups[1][1] >= 2) return 'フルハウス';
  if (groups[0][1] === 3) return 'スリーカード';
  if (groups[0][1] === 2 && groups.length > 1 && groups[1][1] === 2) return 'ツーペア';
  if (groups[0][1] === 2) return 'ワンペア';
  return 'ハイカード';
}

// a > b なら正、a < b なら負、同等なら0。tiebreak は前方一致で比較（長さ違いは共通部分まで）
export function compareHands(a: HandValue, b: HandValue): number {
  if (a.cat !== b.cat) return a.cat - b.cat;
  const n = Math.min(a.tiebreak.length, b.tiebreak.length);
  for (let i = 0; i < n; i++) {
    if (a.tiebreak[i] !== b.tiebreak[i]) return a.tiebreak[i] - b.tiebreak[i];
  }
  return 0;
}
