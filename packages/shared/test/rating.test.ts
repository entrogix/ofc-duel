import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRatingChanges, DEFAULT_RATING, RATING_FLOOR, rankFor } from '../src/rating';

test('レート: 同レート2人は勝者+16/敗者-16のゼロサム', () => {
  const changes = computeRatingChanges([
    { uid: 'A', rating: 1000, chips: 70 },
    { uid: 'B', rating: 1000, chips: 30 },
  ]);
  assert.equal(changes.get('A')!.delta, 16);
  assert.equal(changes.get('B')!.delta, -16);
  assert.equal(changes.get('A')!.after, 1016);
  // ゼロサム
  assert.equal(changes.get('A')!.delta + changes.get('B')!.delta, 0);
});

test('レート: ボット（uid空）相手は変動なし＝水増し防止', () => {
  const changes = computeRatingChanges([
    { uid: 'A', rating: 1000, chips: 80 },
    { uid: '', rating: 1000, chips: 20 }, // bot
  ]);
  assert.equal(changes.size, 0);
});

test('レート: 人間1人＋ボット3人なら変動ゼロ', () => {
  const changes = computeRatingChanges([
    { uid: 'A', rating: 1200, chips: 90 },
    { uid: '', rating: 1000, chips: 10 },
    { uid: '', rating: 1000, chips: 30 },
    { uid: '', rating: 1000, chips: 20 },
  ]);
  assert.equal(changes.size, 0);
});

test('レート: 格上に勝つと多く上がり、格下に勝っても少ない', () => {
  const underdog = computeRatingChanges([
    { uid: 'low', rating: 800, chips: 60 },
    { uid: 'high', rating: 1600, chips: 40 },
  ]);
  const favorite = computeRatingChanges([
    { uid: 'high', rating: 1600, chips: 60 },
    { uid: 'low', rating: 800, chips: 40 },
  ]);
  assert.ok(underdog.get('low')!.delta > favorite.get('high')!.delta);
});

test('レート: 3人でもゼロサム（人間のみ）', () => {
  const changes = computeRatingChanges([
    { uid: 'A', rating: 1000, chips: 70 },
    { uid: 'B', rating: 1000, chips: 50 },
    { uid: 'C', rating: 1000, chips: 30 },
  ]);
  const sum = ['A', 'B', 'C'].reduce((s, u) => s + changes.get(u)!.delta, 0);
  assert.ok(Math.abs(sum) <= 1); // 丸め誤差±1まで許容
  assert.ok(changes.get('A')!.delta > 0);
  assert.ok(changes.get('C')!.delta < 0);
});

test('レート: 同チップは引き分け扱いで変動ほぼ0', () => {
  const changes = computeRatingChanges([
    { uid: 'A', rating: 1000, chips: 50 },
    { uid: 'B', rating: 1000, chips: 50 },
  ]);
  assert.equal(changes.get('A')!.delta, 0);
  assert.equal(changes.get('B')!.delta, 0);
});

test('レート: 下限フロアを下回らない', () => {
  const changes = computeRatingChanges([
    { uid: 'A', rating: RATING_FLOOR, chips: 10 },
    { uid: 'B', rating: 2000, chips: 90 },
  ]);
  assert.ok(changes.get('A')!.after >= RATING_FLOOR);
});

test('ランク: しきい値と初期レート', () => {
  assert.equal(rankFor(DEFAULT_RATING).key, 'silver');
  assert.equal(rankFor(0).key, 'bronze');
  assert.equal(rankFor(799).key, 'bronze');
  assert.equal(rankFor(800).key, 'silver');
  assert.equal(rankFor(1100).key, 'gold');
  assert.equal(rankFor(2500).key, 'master');
});
