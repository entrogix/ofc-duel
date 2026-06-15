import { Card } from './cards';
import { Placement } from './engine';
import { Board, boardIsComplete, evaluateBoard, qualifiesFantasy, ROW_CAPACITY, Row, ROWS, staysFantasy } from './royalties';

// ヒューリスティックCPU:
// - 配られたカードの行割当を全列挙し、評価関数が最大の割当を選ぶ
// - 盤面完成時は正確に役判定（バーストは大幅減点）
// - 未完成時は「できている役 + 伸びしろ - バーストリスク」で概算

interface Group {
  rank: number;
  count: number;
}

function groups(cards: Card[]): Group[] {
  const m = new Map<number, number>();
  for (const c of cards) m.set(c.rank, (m.get(c.rank) ?? 0) + 1);
  return [...m.entries()]
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);
}

// 「現時点でできている役」の強さ。フロント/ミドル/バックの強さ順チェックにも使う共通スケール
function madeScore(cards: Card[]): number {
  if (cards.length === 0) return 0;
  const g = groups(cards);
  if (g[0].count === 4) return 320 + g[0].rank;
  if (g[0].count === 3 && g.length > 1 && g[1].count >= 2) return 260 + g[0].rank;
  if (g[0].count === 3) return 160 + g[0].rank * 2;
  if (g[0].count === 2 && g.length > 1 && g[1].count === 2) return 110 + g[0].rank;
  if (g[0].count === 2) return 60 + g[0].rank * 2;
  return g[0].rank * 0.5;
}

function rowPotential(cards: Card[], row: Row): number {
  if (cards.length === 0) return 0;
  let s = madeScore(cards);
  if (row !== 'front' && cards.length >= 3) {
    // フラッシュ・ストレートの芽（同スートが揃っている / ランクが密集している）
    const suitCounts = new Map<string, number>();
    for (const c of cards) suitCounts.set(c.suit, (suitCounts.get(c.suit) ?? 0) + 1);
    const maxSuit = Math.max(...suitCounts.values());
    if (maxSuit === cards.length) s += 5 * maxSuit;
    const ranks = [...new Set(cards.map((c) => c.rank))].sort((a, b) => a - b);
    if (ranks.length === cards.length && ranks[ranks.length - 1] - ranks[0] <= 4) s += 8;
  }
  if (row === 'front') {
    const g = groups(cards);
    // フロントの高ペアはロイヤリティ/FLに直結
    if (g[0].count === 2 && g[0].rank >= 6) s += (g[0].rank - 5) * 3;
    if (g[0].count === 2 && g[0].rank >= 12) s += 25; // QQ以上 → FL圏
  }
  // 高ランクカードの足しは控えめに
  s += cards.reduce((acc, c) => acc + c.rank, 0) * 0.12;
  return s;
}

function heuristicScore(board: Board): number {
  const fs = madeScore(board.front);
  const ms = madeScore(board.middle);
  const bs = madeScore(board.back);
  // 残り枠が多い行ほど今後強くなれる見込み（slack）を少しだけ認め つつ、順序違反を強く罰する
  const slackM = (ROW_CAPACITY.middle - board.middle.length) * 12;
  const slackB = (ROW_CAPACITY.back - board.back.length) * 12;
  let penalty = 0;
  if (fs > ms + slackM) penalty += 150 + (fs - ms - slackM) * 3;
  if (ms > bs + slackB) penalty += 150 + (ms - bs - slackB) * 3;
  if (fs > bs + slackB) penalty += 100 + (fs - bs - slackB) * 2;
  // 序盤にフロントを強くするのはバーストの種（残り枚数が多いほど強い役を前に置くのを嫌う）
  const placed = board.front.length + board.middle.length + board.back.length;
  const early = Math.max(0, (13 - placed) / 8);
  penalty += early * fs * 0.9;
  return (
    rowPotential(board.front, 'front') +
    rowPotential(board.middle, 'middle') * 1.1 +
    rowPotential(board.back, 'back') * 1.25 -
    penalty
  );
}

function exactScore(board: Board): number {
  const ev = evaluateBoard(board);
  if (ev.fouled) {
    // 全候補バーストの場合に「マシなバースト」を選べるよう差は残す
    return -10000 + madeScore(board.back) + madeScore(board.middle);
  }
  let s = 500 + ev.royalties.total * 14;
  s += madeScore(board.back) * 0.5 + madeScore(board.middle) * 0.4 + madeScore(board.front) * 0.3;
  if (qualifiesFantasy(ev)) s += 90;
  if (staysFantasy(ev)) s += 60;
  return s;
}

function scoreCandidate(board: Board): number {
  return boardIsComplete(board) ? exactScore(board) : heuristicScore(board);
}

function cloneBoard(b: Board): Board {
  return { front: b.front.slice(), middle: b.middle.slice(), back: b.back.slice() };
}

// dealt の各カードを行に割り当てる全組合せを列挙して最良を返す
function bestAssignment(board: Board, dealt: Card[], rng: () => number): Placement[] {
  const remaining: Record<Row, number> = {
    front: ROW_CAPACITY.front - board.front.length,
    middle: ROW_CAPACITY.middle - board.middle.length,
    back: ROW_CAPACITY.back - board.back.length,
  };
  const totalSlots = remaining.front + remaining.middle + remaining.back;
  if (dealt.length > totalSlots) throw new Error('手札が残り枠を超えています');
  // 最終ストリートでは全枠を埋める必要がある
  const mustFill = dealt.length === totalSlots;

  let best: Row[] | null = null;
  let bestScore = -Infinity;
  const assign: Row[] = [];

  const recurse = (i: number, rem: Record<Row, number>) => {
    if (i === dealt.length) {
      const candidate = cloneBoard(board);
      assign.forEach((row, k) => candidate[row].push(dealt[k]));
      const score = scoreCandidate(candidate) + rng() * 0.01; // 同点はランダムに散らす
      if (score > bestScore) {
        bestScore = score;
        best = assign.slice();
      }
      return;
    }
    for (const row of ROWS) {
      if (rem[row] <= 0) continue;
      // 残カードで他の行を埋め切れなくなる割当は不可（mustFill時）
      rem[row] -= 1;
      const left = dealt.length - i - 1;
      const slots = rem.front + rem.middle + rem.back;
      if (!mustFill || left <= slots) {
        assign.push(row);
        recurse(i + 1, rem);
        assign.pop();
      }
      rem[row] += 1;
    }
  };
  recurse(0, { ...remaining });

  if (!best) throw new Error('配置可能な割当がありません');
  return (best as Row[]).map((row, k) => ({ card: dealt[k], row }));
}

function* combinations<T>(arr: T[], k: number): Generator<T[]> {
  const n = arr.length;
  const idx = Array.from({ length: k }, (_, i) => i);
  if (k > n) return;
  while (true) {
    yield idx.map((i) => arr[i]);
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i--;
    if (i < 0) return;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
}

// FL: 13枚一括配置。バック5枚×ミドル5枚の全組合せ（約7.2万通り）を正確に評価
function bestFantasyPlacement(dealt: Card[], rng: () => number): Placement[] {
  let best: Board | null = null;
  let bestScore = -Infinity;
  for (const back of combinations(dealt, 5)) {
    const restAfterBack = dealt.filter((c) => !back.includes(c));
    for (const middle of combinations(restAfterBack, 5)) {
      const front = restAfterBack.filter((c) => !middle.includes(c));
      const board: Board = { front, middle, back };
      const score = exactScore(board) + rng() * 0.01;
      if (score > bestScore) {
        bestScore = score;
        best = board;
      }
    }
  }
  if (!best) throw new Error('FL配置の探索に失敗しました');
  const placements: Placement[] = [];
  for (const row of ROWS) for (const card of best[row]) placements.push({ card, row });
  return placements;
}

export function chooseCpuPlacement(board: Board, dealt: Card[], rng: () => number = Math.random): Placement[] {
  if (dealt.length === 13) return bestFantasyPlacement(dealt, rng);
  return bestAssignment(board, dealt, rng);
}

// 捨てあり版（ターボ・パイナップル）: dealt から placeCount 枚を選んで配置し、残りを捨てる。
// 「どの placeCount 枚を残すか」を全列挙し、配置後の盤面評価が最良の選択を返す。
export function chooseCpuPlacementWithDiscard(
  board: Board,
  dealt: Card[],
  placeCount: number,
  rng: () => number = Math.random,
): { placements: Placement[]; discarded: Card[] } {
  if (placeCount >= dealt.length) {
    return { placements: bestAssignment(board, dealt, rng), discarded: [] };
  }
  let best: { placements: Placement[]; discarded: Card[]; score: number } | null = null;
  for (const keep of combinations(dealt, placeCount)) {
    const discarded = dealt.filter((c) => !keep.includes(c));
    const placements = bestAssignment(board, keep, rng);
    const candidate = cloneBoard(board);
    for (const p of placements) candidate[p.row].push(p.card);
    const score = scoreCandidate(candidate) + rng() * 0.01;
    if (!best || score > best.score) best = { placements, discarded, score };
  }
  if (!best) throw new Error('捨て付き配置の探索に失敗しました');
  return { placements: best.placements, discarded: best.discarded };
}
