import { compareHands } from './evaluator';
import { Board, BoardEval, evaluateBoard, ROWS } from './royalties';

export interface PairResult {
  a: number; // プレイヤーindex
  b: number;
  rowWins: [number, number, number]; // front/middle/back: aから見て +1/-1/0
  scoop: boolean;
  netToA: number; // aが受け取る点（負なら支払い）
  reason: 'normal' | 'a_foul' | 'b_foul' | 'both_foul';
}

export interface HandScore {
  evals: BoardEval[];
  pairs: PairResult[];
  net: number[]; // プレイヤーごとの増減（ゼロサム）
}

// 全ペア間で精算する。boards はプレイヤーindex順。
export function scoreHand(boards: Board[]): HandScore {
  const evals = boards.map(evaluateBoard);
  const n = boards.length;
  const net = new Array(n).fill(0);
  const pairs: PairResult[] = [];

  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      const ea = evals[a];
      const eb = evals[b];
      let result: PairResult;
      if (ea.fouled && eb.fouled) {
        result = { a, b, rowWins: [0, 0, 0], scoop: false, netToA: 0, reason: 'both_foul' };
      } else if (ea.fouled) {
        // バースト側が 6点+相手ロイヤリティ を支払う
        result = { a, b, rowWins: [-1, -1, -1], scoop: true, netToA: -(6 + eb.royalties.total), reason: 'a_foul' };
      } else if (eb.fouled) {
        result = { a, b, rowWins: [1, 1, 1], scoop: true, netToA: 6 + ea.royalties.total, reason: 'b_foul' };
      } else {
        const rowWins = ROWS.map((row) => {
          const c = compareHands(ea[row], eb[row]);
          return c > 0 ? 1 : c < 0 ? -1 : 0;
        }) as [number, number, number];
        const lines = rowWins[0] + rowWins[1] + rowWins[2];
        const scoop = Math.abs(lines) === 3;
        const lineScore = scoop ? lines * 2 : lines; // 3行全勝は6点（倍額）
        const netToA = lineScore + ea.royalties.total - eb.royalties.total;
        result = { a, b, rowWins, scoop, netToA, reason: 'normal' };
      }
      net[a] += result.netToA;
      net[b] -= result.netToA;
      pairs.push(result);
    }
  }
  return { evals, pairs, net };
}
