// FL（ファンタジーランド）の継続率シミュレーション。
//   tsx sim/fl_continuation_sim.ts [N=13|14|...] [samples]
//
// FL中は配られたカードを「13枚に絞って」3/5/5へ配置する（N>13なら N-13枚捨て）。
// 継続条件: フロント=スリーカード / ミドル=フルハウス以上 / バック=フォーカード以上（バーストなし）。
// 方策: 継続のEVが極めて高いため、上級者は「継続を最優先、次にロイヤリティ」で組む。それを再現する。
//
// 継続率 p が分かれば、1回FLに入ってからの平均連続FLハンド数 = 1/(1-p)。
// 突入率 e と合わせ、定常状態でFLにいる割合 f = e / (1 - p + e)。

import { Card, newDeck, shuffle } from '../src/cards';
import { Board, evaluateBoard, staysFantasy } from '../src/royalties';

function* combinations<T>(arr: T[], k: number): Generator<T[]> {
  const n = arr.length;
  if (k > n) return;
  const idx = Array.from({ length: k }, (_, i) => i);
  while (true) {
    yield idx.map((i) => arr[i]);
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i--;
    if (i < 0) return;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
}

interface FlResult {
  stayed: boolean;
  fouled: boolean;
  royalty: number;
}

// N枚から13枚を選び3/5/5へ。継続最優先(=1e6) → ロイヤリティ で最良を返す。
function placeFantasy(cards: Card[]): FlResult {
  let bestScore = -Infinity;
  let best: { stayed: boolean; royalty: number } | null = null;
  for (const back of combinations(cards, 5)) {
    const rem1 = cards.filter((c) => !back.includes(c));
    for (const middle of combinations(rem1, 5)) {
      const rem2 = rem1.filter((c) => !middle.includes(c));
      for (const front of combinations(rem2, 3)) {
        const board: Board = { front, middle, back };
        const ev = evaluateBoard(board);
        if (ev.fouled) continue;
        const score = (staysFantasy(ev) ? 1e6 : 0) + ev.royalties.total;
        if (score > bestScore) {
          bestScore = score;
          best = { stayed: staysFantasy(ev), royalty: ev.royalties.total };
        }
      }
    }
  }
  if (!best) return { stayed: false, fouled: true, royalty: 0 }; // 非バースト配置が存在しない＝バースト
  return { stayed: best.stayed, fouled: false, royalty: best.royalty };
}

function main(): void {
  const N = Number(process.argv[2] ?? 13);
  const SAMPLES = Number(process.argv[3] ?? 1500);
  const ENTRY = 0.062; // 1枚捨て版のFL突入率（completion_sim より）

  let stayed = 0;
  let fouled = 0;
  let roySum = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const cards = shuffle(newDeck()).slice(0, N);
    const r = placeFantasy(cards);
    if (r.fouled) fouled++;
    else {
      roySum += r.royalty;
      if (r.stayed) stayed++;
    }
  }
  const p = stayed / SAMPLES;
  const streak = 1 / (1 - p);
  const share = ENTRY / (1 - p + ENTRY);

  console.log(`\nFL配り ${N}枚（${N - 13}枚捨て） / ${SAMPLES.toLocaleString()} サンプル\n`);
  console.log(`継続率 p            : ${(100 * p).toFixed(1)}%`);
  console.log(`バースト率(FL中)    : ${(100 * fouled / SAMPLES).toFixed(1)}%`);
  console.log(`平均ロイヤリティ    : ${(roySum / Math.max(1, SAMPLES - fouled)).toFixed(1)} 点`);
  console.log(`平均連続FL数 1/(1-p): ${streak.toFixed(2)} ハンド`);
  console.log(`FL滞在割合(突入${(100 * ENTRY).toFixed(1)}%前提): ${(100 * share).toFixed(1)}%`);
}

main();
