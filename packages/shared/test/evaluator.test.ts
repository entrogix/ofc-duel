import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCards } from '../src/cards';
import { compareHands, evaluate3, evaluate5, HandCat } from '../src/evaluator';
import { evaluateBoard, qualifiesFantasy, royaltyBack, royaltyFront, royaltyMiddle, staysFantasy } from '../src/royalties';
import { scoreHand } from '../src/scoring';

test('5枚役の判定', () => {
  assert.equal(evaluate5(parseCards('As Ks Qs Js Ts')).cat, HandCat.StraightFlush);
  assert.equal(evaluate5(parseCards('5s 4s 3s 2s As')).cat, HandCat.StraightFlush);
  assert.equal(evaluate5(parseCards('5s 4s 3s 2s As')).tiebreak[0], 5); // wheel
  assert.equal(evaluate5(parseCards('9c 9d 9h 9s 2c')).cat, HandCat.Quads);
  assert.equal(evaluate5(parseCards('9c 9d 9h 2s 2c')).cat, HandCat.FullHouse);
  assert.equal(evaluate5(parseCards('Kc 9c 7c 4c 2c')).cat, HandCat.Flush);
  assert.equal(evaluate5(parseCards('9c 8d 7h 6s 5c')).cat, HandCat.Straight);
  assert.equal(evaluate5(parseCards('Ad Kh 5c 4s 3d')).cat, HandCat.High); // A-5の4枚 + K はストレートではない
  assert.equal(evaluate5(parseCards('9c 9d 9h 6s 5c')).cat, HandCat.Trips);
  assert.equal(evaluate5(parseCards('9c 9d 6h 6s 5c')).cat, HandCat.TwoPair);
  assert.equal(evaluate5(parseCards('9c 9d 7h 6s 5c')).cat, HandCat.Pair);
  assert.equal(evaluate5(parseCards('Kc 9d 7h 6s 5c')).cat, HandCat.High);
});

test('キッカー比較', () => {
  const a = evaluate5(parseCards('Ac Ad Kh 7s 5c'));
  const b = evaluate5(parseCards('As Ah Qh 7d 5d'));
  assert.ok(compareHands(a, b) > 0);
  const f1 = evaluate5(parseCards('Kc 9c 7c 4c 2c'));
  const f2 = evaluate5(parseCards('Kd 9d 7d 4d 3d'));
  assert.ok(compareHands(f1, f2) < 0);
});

test('3枚役の判定（ストレート・フラッシュなし）', () => {
  assert.equal(evaluate3(parseCards('Qs Qd 2c')).cat, HandCat.Pair);
  assert.equal(evaluate3(parseCards('5s 5d 5c')).cat, HandCat.Trips);
  assert.equal(evaluate3(parseCards('5s 4s 3s')).cat, HandCat.High); // スーテッドコネクタもハイカード
});

test('ロイヤリティ表', () => {
  assert.equal(royaltyFront(evaluate3(parseCards('6s 6d 2c'))), 1);
  assert.equal(royaltyFront(evaluate3(parseCards('As Ad 2c'))), 9);
  assert.equal(royaltyFront(evaluate3(parseCards('5s 5d 2c'))), 0); // 55以下は0
  assert.equal(royaltyFront(evaluate3(parseCards('2s 2d 2c'))), 10);
  assert.equal(royaltyFront(evaluate3(parseCards('As Ad Ac'))), 22);
  assert.equal(royaltyMiddle(evaluate5(parseCards('9c 9d 9h 6s 5c'))), 2);
  assert.equal(royaltyMiddle(evaluate5(parseCards('As Ks Qs Js Ts'))), 30); // ミドルのロイヤルはSF扱い30
  assert.equal(royaltyBack(evaluate5(parseCards('9c 8d 7h 6s 5c'))), 2);
  assert.equal(royaltyBack(evaluate5(parseCards('9s 8s 7s 6s 5s'))), 15);
  assert.equal(royaltyBack(evaluate5(parseCards('As Ks Qs Js Ts'))), 25); // ロイヤル
});

test('バースト判定と同等許容', () => {
  // front QQ > middle 99ペア → バースト
  const fouled = evaluateBoard({
    front: parseCards('Qs Qd 2c'),
    middle: parseCards('9c 9d 7h 6s 5c'),
    back: parseCards('Ac Ad Kh 7s 5h'),
  });
  assert.equal(fouled.fouled, true);
  assert.equal(fouled.royalties.total, 0); // バースト時ロイヤリティ無効

  const ok = evaluateBoard({
    front: parseCards('Qs Qd 2c'),
    middle: parseCards('Kc Kd 7h 6s 5c'),
    back: parseCards('Ac Ad Kh 7s 5h'),
  });
  assert.equal(ok.fouled, false);
});

test('FL突入・継続条件', () => {
  const qq = evaluateBoard({
    front: parseCards('Qs Qd 2c'),
    middle: parseCards('Kc Kd 7h 6s 5c'),
    back: parseCards('Ac Ad Kh 7s 5h'),
  });
  assert.equal(qualifiesFantasy(qq), true);
  const jj = evaluateBoard({
    front: parseCards('Js Jd 2c'),
    middle: parseCards('Kc Kd 7h 6s 5c'),
    back: parseCards('Ac Ad Kh 7s 5h'),
  });
  assert.equal(qualifiesFantasy(jj), false);
  const stay = evaluateBoard({
    front: parseCards('3s 3d 3c'),
    middle: parseCards('Kc Kd Kh 6s 5c'),
    back: parseCards('Ac Ad Ah As 5h'),
  });
  assert.equal(staysFantasy(stay), true);
});

test('採点: 行勝敗・スクープ・ロイヤリティ差額', () => {
  // A: 全行勝ち + ロイヤリティ
  const boardA = {
    front: parseCards('As Ad 2c'), // roy 9
    middle: parseCards('Kc Kd Kh 6s 5c'), // trips roy 2
    back: parseCards('9s 8s 7s 6s 5s'), // SF roy 15
  };
  const boardB = {
    front: parseCards('3s 3d 4c'),
    middle: parseCards('9c 9d 7h 6s 5d'),
    back: parseCards('Tc Td 7d 6c 5h'),
  };
  const result = scoreHand([boardA, boardB]);
  const pair = result.pairs[0];
  assert.equal(pair.scoop, true);
  // 6 (スクープ) + (9+2+15) - 0 = 32
  assert.equal(pair.netToA, 32);
  assert.equal(result.net[0], 32);
  assert.equal(result.net[1], -32);
});

test('採点: バーストは6点+相手ロイヤリティ支払い', () => {
  const foulBoard = {
    front: parseCards('Qs Qd 2c'),
    middle: parseCards('9c 9d 7h 6s 5c'),
    back: parseCards('Ac Ad Kh 7s 5h'),
  };
  const okBoard = {
    front: parseCards('6s 6d 4c'), // roy 1
    middle: parseCards('Tc Td 7h 8s 5d'),
    back: parseCards('Jc Jd 7d 6c 5s'),
  };
  const result = scoreHand([foulBoard, okBoard]);
  assert.equal(result.pairs[0].reason, 'a_foul');
  assert.equal(result.net[0], -7); // 6 + roy1
  assert.equal(result.net[1], 7);
});

test('採点: ゼロサム（3人）', () => {
  const b1 = { front: parseCards('As Kd 2c'), middle: parseCards('9c 9d 7h 6s 5c'), back: parseCards('Ac Ad Kh 7s 5h') };
  const b2 = { front: parseCards('3s 3d 4c'), middle: parseCards('Tc Td 7d 8s 5d'), back: parseCards('Jc Jd 7c 6c 5s') };
  const b3 = { front: parseCards('Qs Qd 2d'), middle: parseCards('Kc Kd 7s 6d 5s'), back: parseCards('2s 2h 8h 9h Th') };
  const result = scoreHand([b1, b2, b3]);
  assert.equal(result.net.reduce((a, b) => a + b, 0), 0);
});
