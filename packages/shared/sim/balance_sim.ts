// 試合バランスのモンテカルロ。
// 目的: 「持ち点」と「ハンド数」を振って、(1)実力が結果に出るか（運だけで決まらないか）
//       (2)平均試合時間（ハンド数）が5〜10分に収まるか を見る。
//
// 実力の指標: 強いAI（全列挙最適 chooseCpuPlacementWithDiscard）と
//             弱いAI（ほぼランダム配置）を戦わせ、強の勝率を測る。
//   - 勝率50% = 運だけ（実力が出ていない）
//   - 勝率が高いほど実力が結果に反映される
// 時間の指標: 平均終了ハンド数（破産で早期終了するほど短い）と規定到達率。
//
// 実行: npx tsx sim/balance_sim.ts
import { chooseCpuPlacementWithDiscard } from '../src/ai';
import { GameEngine, Placement } from '../src/engine';
import { Board, ROW_CAPACITY, Row, ROWS } from '../src/royalties';
import { Card } from '../src/cards';

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 弱いAI: placeCount枚をランダムに選び、空いている行へランダムに置く（バーストを避けない）
function weakPlace(board: Board, dealt: Card[], placeCount: number, rng: () => number): Placement[] {
  const shuffled = [...dealt].sort(() => rng() - 0.5);
  const keep = shuffled.slice(0, placeCount);
  const rem: Record<Row, number> = {
    front: ROW_CAPACITY.front - board.front.length,
    middle: ROW_CAPACITY.middle - board.middle.length,
    back: ROW_CAPACITY.back - board.back.length,
  };
  const placements: Placement[] = [];
  for (const card of keep) {
    const avail = ROWS.filter((r) => rem[r] > 0);
    const row = avail[Math.floor(rng() * avail.length)];
    rem[row] -= 1;
    placements.push({ card, row });
  }
  return placements;
}

function placeCountFor(inFantasy: boolean, street: number): number {
  return inFantasy ? 13 : [5, 4, 4][street];
}

// skill: 1手ごとに確率skillで最適手、(1-skill)でランダム（=ミス）。
// 実力の近い2人（レート対戦で起きる状況）を再現するためのつまみ。
function skillPlace(board: Board, dealt: Card[], placeCount: number, rng: () => number, skill: number): Placement[] {
  // FL（13枚以上）は厳密探索が数百万通りで重いため、シミュレーションでは簡易配置にする。
  // FLは稀（数%）で勝敗の主因ではないため、バランス計測への影響は小さい。
  if (placeCount >= 13) return weakPlace(board, dealt, placeCount, rng);
  if (rng() < skill) return chooseCpuPlacementWithDiscard(board, dealt, placeCount, rng).placements;
  return weakPlace(board, dealt, placeCount, rng);
}


interface GameOutcome {
  winner: 'strong' | 'weak' | 'draw';
  hands: number;
  endedByBankrupt: boolean;
}

function playGame(
  startChips: number,
  targetHands: number,
  rng: () => number,
  selfSkill: number,
  oppSkill: number,
): GameOutcome {
  // seat0 = self, seat1 = opp
  const engine = new GameEngine(
    [{ id: 's', name: 'S' }, { id: 'w', name: 'W' }],
    { startingChips: startChips, targetHands, rng },
  );
  let guard = 0;
  while (engine.state.phase !== 'game_over' && guard++ < 2000) {
    if (engine.state.phase === 'placing') {
      for (const p of engine.state.players) {
        if (p.submitted) continue;
        const n = placeCountFor(p.inFantasy, engine.state.street);
        const placements = skillPlace(p.board, p.dealt, n, rng, p.id === 's' ? selfSkill : oppSkill);
        engine.submitPlacement(p.id, placements);
      }
    } else if (engine.state.phase === 'hand_result') {
      engine.nextHand();
    }
  }
  const s = engine.state.players[0].chips;
  const w = engine.state.players[1].chips;
  return {
    winner: s > w ? 'strong' : w > s ? 'weak' : 'draw',
    hands: engine.state.handNumber,
    endedByBankrupt: s <= 0 || w <= 0,
  };
}

function run(startChips: number, targetHands: number, n: number, selfSkill: number, oppSkill: number): void {
  const rng = mulberry32(startChips * 1000 + targetHands * 7 + Math.round(selfSkill * 10) + Math.round(oppSkill * 100));
  let seat0Wins = 0;
  let draws = 0;
  let totalHands = 0;
  let bankruptEnds = 0;
  for (let i = 0; i < n; i++) {
    const o = playGame(startChips, targetHands, rng, selfSkill, oppSkill);
    if (o.winner === 'strong') seat0Wins += 1;
    else if (o.winner === 'draw') draws += 1;
    totalHands += o.hands;
    if (o.endedByBankrupt) bankruptEnds += 1;
  }
  const decisive = n - draws;
  const winRate = decisive > 0 ? (seat0Wins / decisive) * 100 : 0;
  const avgHands = totalHands / n;
  const estMin = (avgHands * 90) / 60; // 1ハンド≈90秒（1ストリート30秒×3）想定
  console.log(
    `持ち点${String(startChips).padStart(3)} / 上限${String(targetHands).padStart(2)}ハンド | ` +
      `上手側勝率 ${winRate.toFixed(1)}% | 平均 ${avgHands.toFixed(1)}ハンド (~${estMin.toFixed(1)}分) | ` +
      `破産決着 ${((bankruptEnds / n) * 100).toFixed(0)}% | 引分 ${((draws / n) * 100).toFixed(1)}%`,
  );
}

const N = 400;
const CHIPS = [30, 50, 100];
const HANDS = [4, 5, 6, 7, 8, 10];

console.log('=== A. 実力差あり（最適AI vs skill0.6の中級AI）===');
console.log('上手側勝率: 50%=運のみ / 高いほど実力が結果に反映。時間は1ハンド≈90秒で概算\n');
for (const chips of CHIPS) {
  for (const hands of HANDS) run(chips, hands, N, 1.0, 0.6);
  console.log('');
}

console.log('=== B. 同実力（最適AI vs 最適AI）===');
console.log('上手側勝率が50%付近＝同実力なら五分（運で決まる）。引分・破産・時間を見る\n');
for (const chips of CHIPS) {
  for (const hands of HANDS) run(chips, hands, N, 1.0, 1.0);
  console.log('');
}
