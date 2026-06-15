// 配り方（捨ての有無）が役の完成率・バースト率・FL率にどう効くかのモンテカルロ。
//   tsx sim/completion_sim.ts [N]
//
// 方策はどの方式でも共通（既存CPU AIの captured: 残し方を全列挙→最良配置）。
// よって差はもっぱら「配られる枚数＝選択肢の広さ」から来る＝運/実力バランスの指標になる。
//
// ヘッズアップ(2人)前提。1人ぶんを毎回新しいシャッフルから引く（周辺分布は満杯デッキと同じ）。

import { Card, newDeck, shuffle } from '../src/cards';
import { chooseCpuPlacementWithDiscard } from '../src/ai';
import { Board, emptyBoard, evaluateBoard, qualifiesFantasy } from '../src/royalties';
import { HandCat } from '../src/evaluator';

interface Format {
  name: string;
  deal: [number, number, number]; // 各ストリートで配る枚数
  place: [number, number, number]; // 各ストリートで置く枚数（合計13）
}

const FORMATS: Format[] = [
  { name: '現状（捨てなし 5-4-4）', deal: [5, 4, 4], place: [5, 4, 4] },
  { name: '毎ストリート1枚捨て', deal: [6, 5, 5], place: [5, 4, 4] },
  { name: '毎ストリート2枚捨て', deal: [7, 6, 6], place: [5, 4, 4] },
];

interface Stat {
  hands: number;
  fouls: number;
  fl: number;
  royaltySum: number; // 非バーストのロイヤリティ合計
  nonFoul: number;
  backStraightPlus: number;
  backFlushPlus: number;
  backFullPlus: number;
  midPairPlus: number;
  midTripsPlus: number;
  midStraightPlus: number;
  frontPair: number;
  frontQQplus: number;
}

function blankStat(): Stat {
  return {
    hands: 0, fouls: 0, fl: 0, royaltySum: 0, nonFoul: 0,
    backStraightPlus: 0, backFlushPlus: 0, backFullPlus: 0,
    midPairPlus: 0, midTripsPlus: 0, midStraightPlus: 0,
    frontPair: 0, frontQQplus: 0,
  };
}

function playHand(fmt: Format): Board {
  const deck = shuffle(newDeck());
  let cursor = 0;
  const draw = (n: number): Card[] => deck.slice(cursor, (cursor += n));
  const board = emptyBoard();
  for (let s = 0; s < 3; s++) {
    const dealt = draw(fmt.deal[s]);
    const { placements } = chooseCpuPlacementWithDiscard(board, dealt, fmt.place[s]);
    for (const p of placements) board[p.row].push(p.card);
  }
  return board;
}

function record(stat: Stat, board: Board): void {
  stat.hands++;
  const ev = evaluateBoard(board);
  if (ev.fouled) {
    stat.fouls++;
    return;
  }
  stat.nonFoul++;
  stat.royaltySum += ev.royalties.total;
  if (qualifiesFantasy(ev)) stat.fl++;
  if (ev.back.cat >= HandCat.Straight) stat.backStraightPlus++;
  if (ev.back.cat >= HandCat.Flush) stat.backFlushPlus++;
  if (ev.back.cat >= HandCat.FullHouse) stat.backFullPlus++;
  if (ev.middle.cat >= HandCat.Pair) stat.midPairPlus++;
  if (ev.middle.cat >= HandCat.Trips) stat.midTripsPlus++;
  if (ev.middle.cat >= HandCat.Straight) stat.midStraightPlus++;
  if (ev.front.cat >= HandCat.Pair) stat.frontPair++;
  if (ev.front.cat === HandCat.Trips || (ev.front.cat === HandCat.Pair && ev.front.tiebreak[0] >= 12)) stat.frontQQplus++;
}

function pct(n: number, d: number): string {
  return d === 0 ? '  -  ' : `${((100 * n) / d).toFixed(1)}%`.padStart(6);
}

function main(): void {
  const N = Number(process.argv[2] ?? 30000);
  console.log(`\nヘッズアップ・各方式 ${N.toLocaleString()} ハンドのモンテカルロ\n`);

  const rows: [string, Stat][] = [];
  for (const fmt of FORMATS) {
    const stat = blankStat();
    for (let i = 0; i < N; i++) record(stat, playHand(fmt));
    rows.push([fmt.name, stat]);
  }

  const labels = [
    ['バースト率', (s: Stat) => pct(s.fouls, s.hands)],
    ['FL突入率（フロントQQ+）', (s: Stat) => pct(s.fl, s.hands)],
    ['平均ロイヤリティ（非バースト）', (s: Stat) => (s.royaltySum / Math.max(1, s.nonFoul)).toFixed(2).padStart(6)],
    ['バック ストレート以上', (s: Stat) => pct(s.backStraightPlus, s.hands)],
    ['バック フラッシュ以上', (s: Stat) => pct(s.backFlushPlus, s.hands)],
    ['バック フルハウス以上', (s: Stat) => pct(s.backFullPlus, s.hands)],
    ['ミドル ワンペア以上', (s: Stat) => pct(s.midPairPlus, s.hands)],
    ['ミドル スリーカード以上', (s: Stat) => pct(s.midTripsPlus, s.hands)],
    ['ミドル ストレート以上', (s: Stat) => pct(s.midStraightPlus, s.hands)],
    ['フロント ペア以上', (s: Stat) => pct(s.frontPair, s.hands)],
  ] as const;

  const head = '指標'.padEnd(30) + rows.map(([n]) => n.padStart(16)).join('');
  console.log(head);
  console.log('-'.repeat(head.length));
  for (const [label, fn] of labels) {
    console.log(label.padEnd(30) + rows.map(([, s]) => fn(s).padStart(16)).join(''));
  }
  console.log('\nドロー枚数(1人): ' + FORMATS.map((f) => `${f.name.split('（')[0]}=${f.deal.reduce((a, b) => a + b)}枚`).join(' / '));
  console.log('ヘッズアップ消費(2人): ' + FORMATS.map((f) => `${f.deal.reduce((a, b) => a + b) * 2}枚`).join(' / ') + '（デッキ52枚以内）');
}

main();
