import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine, GameState, PlayerState } from '../src/engine';
import { chooseCpuPlacementWithDiscard } from '../src/ai';
import { viewFor } from '../src/view';
import { boardIsComplete } from '../src/royalties';

// 再現性のある簡易乱数
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 各ストリートで「置く」枚数（残り1枚は捨て）
function placeCountFor(p: PlayerState, street: number): number {
  if (p.inFantasy) return 13;
  return [5, 4, 4][street];
}

function cpuPlayAll(engine: GameEngine, rng: () => number): void {
  const s: GameState = engine.state;
  for (const p of s.players) {
    if (p.submitted) continue;
    const n = placeCountFor(p, s.street);
    const { placements } = chooseCpuPlacementWithDiscard(p.board, p.dealt, n, rng);
    engine.submitPlacement(p.id, placements);
  }
}

function playFullGame(seed: number): GameEngine {
  const rng = mulberry32(seed);
  const engine = new GameEngine(
    [{ id: 'p0', name: 'CPU0', isCpu: true }, { id: 'p1', name: 'CPU1', isCpu: true }],
    { rng },
  );
  let guard = 0;
  while (engine.state.phase !== 'game_over') {
    if (++guard > 500) throw new Error('game did not finish');
    if (engine.state.phase === 'placing') cpuPlayAll(engine, rng);
    else if (engine.state.phase === 'hand_result') engine.nextHand();
  }
  return engine;
}

test('ヘッズアップCPU戦が最後まで進行しチップはゼロサム', () => {
  for (const seed of [42, 7, 99, 123]) {
    const engine = playFullGame(seed);
    assert.equal(engine.state.phase, 'game_over');
    assert.ok(engine.state.winners && engine.state.winners.length >= 1);
    const total = engine.state.players.reduce((acc, p) => acc + p.chips, 0);
    assert.equal(total, 100); // 初期50×2人
  }
});

test('3人以上は拒否される（ヘッズアップ専用）', () => {
  assert.throws(() => {
    new GameEngine([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
    ]);
  });
});

test('6-5-5配りで13枚配置・3枚捨てになる', () => {
  const rng = mulberry32(7);
  const engine = new GameEngine([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], { rng });
  assert.equal(engine.state.players[0].dealt.length, 6); // 初回6枚配り
  for (let street = 0; street < 3; street++) {
    cpuPlayAll(engine, rng);
  }
  assert.equal(engine.state.phase, 'hand_result');
  for (const p of engine.state.players) {
    assert.ok(boardIsComplete(p.board), '13枚で盤面完成');
    assert.equal(p.discards.length, 3, '3枚捨て');
  }
});

test('ビュー: 配置・捨て札は確定まで相手に見えず、確定で公開される', () => {
  const rng = mulberry32(11);
  const engine = new GameEngine([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], { rng });
  const before = viewFor(engine.state, 'a');
  assert.equal(before.you.dealt.length, 6);
  assert.equal(before.you.discards.length, 0);

  // bだけ確定 → aからは bの配置も捨て札もまだ見えない（同時公開）
  {
    const b = engine.state.players[1];
    const { placements } = chooseCpuPlacementWithDiscard(b.board, b.dealt, 5, rng);
    engine.submitPlacement('b', placements);
  }
  const mid = viewFor(engine.state, 'a');
  assert.equal(mid.opponents[0].board.front.length + mid.opponents[0].board.middle.length + mid.opponents[0].board.back.length, 0);
  assert.equal(mid.opponents[0].discards.length, 0);

  // aも確定 → street1へ。bのstreet0の配置(5枚)と捨て札(1枚)が公開される
  {
    const a = engine.state.players[0];
    const { placements } = chooseCpuPlacementWithDiscard(a.board, a.dealt, 5, rng);
    engine.submitPlacement('a', placements);
  }
  const s1 = viewFor(engine.state, 'a');
  assert.equal(s1.street, 1);
  assert.equal(s1.opponents[0].board.front.length + s1.opponents[0].board.middle.length + s1.opponents[0].board.back.length, 5);
  assert.equal(s1.opponents[0].discards.length, 1, '相手の捨て札が見える');
  assert.equal(s1.you.discards.length, 1, '自分の捨て札も見える');

  // 残りを進めて精算
  for (let street = 1; street < 3; street++) cpuPlayAll(engine, rng);
  const after = viewFor(engine.state, 'a');
  assert.equal(after.phase, 'hand_result');
  assert.ok(after.boards && after.boards.length === 2);
  assert.equal(after.opponents[0].discards.length, 3, '精算時は捨て札3枚すべて公開');
});

test('不正な配置は拒否される', () => {
  const rng = mulberry32(13);
  const engine = new GameEngine([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], { rng });
  const p = engine.state.players[0];
  // 配置枚数が足りない（5枚必要なのに1枚）
  assert.throws(() => {
    engine.submitPlacement('a', [{ card: p.dealt[0], row: 'back' as const }]);
  });
  // 5枚すべてフロントは定員(3)超過
  assert.throws(() => {
    engine.submitPlacement('a', p.dealt.slice(0, 5).map((card) => ({ card, row: 'front' as const })));
  });
});

test('1枚捨てCPUのバースト率が許容範囲（<25%）', () => {
  let hands = 0;
  let fouls = 0;
  const rng2 = mulberry32(99);
  for (let g = 0; g < 10; g++) {
    const engine = new GameEngine([{ id: 'p0', name: 'C0', isCpu: true }, { id: 'p1', name: 'C1', isCpu: true }], { rng: rng2 });
    let guard = 0;
    while (engine.state.phase !== 'game_over' && guard++ < 300) {
      if (engine.state.phase === 'placing') cpuPlayAll(engine, rng2);
      else if (engine.state.phase === 'hand_result') {
        hands += 2;
        fouls += engine.state.lastResult!.score.evals.filter((e) => e.fouled).length;
        engine.nextHand();
      }
    }
    if (engine.state.phase === 'game_over' && engine.state.lastResult) {
      hands += 2;
      fouls += engine.state.lastResult.score.evals.filter((e) => e.fouled).length;
    }
  }
  assert.ok(hands > 0);
  const foulRate = fouls / hands;
  assert.ok(foulRate < 0.25, `foul rate too high: ${(foulRate * 100).toFixed(1)}%`);
});
