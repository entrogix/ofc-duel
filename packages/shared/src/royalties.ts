import { Card } from './cards';
import { compareHands, evaluate3, evaluate5, HandCat, HandValue } from './evaluator';

export interface Board {
  front: Card[]; // 3枚
  middle: Card[]; // 5枚
  back: Card[]; // 5枚
}

export type Row = 'front' | 'middle' | 'back';
export const ROWS: Row[] = ['front', 'middle', 'back'];
export const ROW_CAPACITY: Record<Row, number> = { front: 3, middle: 5, back: 5 };

export function emptyBoard(): Board {
  return { front: [], middle: [], back: [] };
}

export function cloneBoard(b: Board): Board {
  return { front: b.front.slice(), middle: b.middle.slice(), back: b.back.slice() };
}

export function boardIsComplete(b: Board): boolean {
  return b.front.length === 3 && b.middle.length === 5 && b.back.length === 5;
}

export interface BoardEval {
  front: HandValue;
  middle: HandValue;
  back: HandValue;
  fouled: boolean;
  royalties: { front: number; middle: number; back: number; total: number };
}

// フロント: 66ペア=1点〜AAペア=9点 / 222=10点〜AAA=22点
export function royaltyFront(v: HandValue): number {
  if (v.cat === HandCat.Trips) return v.tiebreak[0] + 8;
  if (v.cat === HandCat.Pair && v.tiebreak[0] >= 6) return v.tiebreak[0] - 5;
  return 0;
}

export function royaltyMiddle(v: HandValue): number {
  switch (v.cat) {
    case HandCat.Trips: return 2;
    case HandCat.Straight: return 4;
    case HandCat.Flush: return 8;
    case HandCat.FullHouse: return 12;
    case HandCat.Quads: return 20;
    case HandCat.StraightFlush: return 30;
    default: return 0;
  }
}

export function royaltyBack(v: HandValue): number {
  switch (v.cat) {
    case HandCat.Straight: return 2;
    case HandCat.Flush: return 4;
    case HandCat.FullHouse: return 6;
    case HandCat.Quads: return 10;
    case HandCat.StraightFlush: return v.tiebreak[0] === 14 ? 25 : 15; // ロイヤル25
    default: return 0;
  }
}

export function evaluateBoard(b: Board): BoardEval {
  const front = evaluate3(b.front);
  const middle = evaluate5(b.middle);
  const back = evaluate5(b.back);
  // フロント ≦ ミドル ≦ バック を満たさなければバースト（同等は許容）
  const fouled =
    compareHands(front, middle) > 0 || compareHands(middle, back) > 0;
  const roy = fouled
    ? { front: 0, middle: 0, back: 0, total: 0 }
    : (() => {
        const f = royaltyFront(front);
        const m = royaltyMiddle(middle);
        const bk = royaltyBack(back);
        return { front: f, middle: m, back: bk, total: f + m + bk };
      })();
  return { front, middle, back, fouled, royalties: roy };
}

// FL突入条件: バーストなし かつ フロントがQQペア以上（スリーカード含む）
export function qualifiesFantasy(ev: BoardEval): boolean {
  if (ev.fouled) return false;
  if (ev.front.cat === HandCat.Trips) return true;
  return ev.front.cat === HandCat.Pair && ev.front.tiebreak[0] >= 12;
}

// FL継続条件: フロント3カード / ミドルFH以上 / バック4カード以上
export function staysFantasy(ev: BoardEval): boolean {
  if (ev.fouled) return false;
  return (
    ev.front.cat === HandCat.Trips ||
    ev.middle.cat >= HandCat.FullHouse ||
    ev.back.cat >= HandCat.Quads
  );
}
