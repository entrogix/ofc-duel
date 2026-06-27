// ランダムマッチ（人間同士）・制限時間・再接続・レートのスモークテスト
// タイミングを短縮した同一プロセスのサーバーに接続して検証する
process.env.PORT = process.env.PORT ?? '8799';
process.env.OFC_RESULT_ADVANCE_MS = '250';
process.env.OFC_TARGET_HANDS = '3'; // テスト高速化（本番デフォルトは10）
process.env.OFC_BOT_PLACE_DELAY_MS = '30';
process.env.OFC_RECONNECT_GRACE_MS = '600';
process.env.OFC_PLACE_LIMIT_MS = '700';

import { tmpdir } from 'node:os';
import { join } from 'node:path';
// レート永続ファイルは一時ディレクトリに隔離（リポジトリやローカル戦績を汚さない）
process.env.OFC_RATING_FILE = join(tmpdir(), `ofc_rating_test_${process.pid}.json`);

import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { chooseCpuPlacementWithDiscard } from '../../shared/src/ai';
import type { PlayerGameView } from '../../shared/src/view';

const URL = `ws://localhost:${process.env.PORT}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface BotOpts {
  autoPlay?: boolean; // state を受けたら自動配置するか
  onState?: (view: PlayerGameView, raw: any) => void;
}

class TestClient {
  ws: WebSocket;
  playerId: string | null = null;
  token: string | null = null;
  random = false;
  lastView: PlayerGameView | null = null;
  sawDeadline = false;
  matched = false;
  gameOver = false;
  winners: string[] | null = null;
  ratingMsg: { before: number; after: number; delta: number; rank: string } | null = null;
  private placedKeys = new Set<string>();
  private opts: BotOpts;

  constructor(opts: BotOpts = {}) {
    this.opts = { autoPlay: true, ...opts };
    this.ws = new WebSocket(URL);
    this.ws.on('message', (raw) => this.onMessage(JSON.parse(String(raw))));
  }

  private onMessage(msg: any): void {
    switch (msg.type) {
      case 'joined':
        this.playerId = msg.playerId;
        this.token = msg.reconnectToken ?? this.token;
        this.random = !!msg.random;
        break;
      case 'state': {
        const view = msg.view as PlayerGameView;
        this.lastView = view;
        this.matched = true;
        if (typeof msg.placeDeadline === 'number') this.sawDeadline = true;
        if (view.phase === 'game_over') {
          this.gameOver = true;
          this.winners = view.winners;
        }
        this.opts.onState?.(view, msg);
        if (this.opts.autoPlay) this.maybePlace(view);
        break;
      }
      case 'rating':
        this.ratingMsg = { before: msg.before, after: msg.after, delta: msg.delta, rank: msg.rank };
        break;
    }
  }

  private maybePlace(view: PlayerGameView): void {
    if (view.phase !== 'placing') return;
    if (view.you.submitted || view.you.dealt.length === 0) return;
    const key = `${view.handNumber}:${view.street}`;
    if (this.placedKeys.has(key)) return;
    this.placedKeys.add(key);
    const { placements } = chooseCpuPlacementWithDiscard(view.you.board, view.you.dealt, view.you.needPlace);
    this.send({ type: 'place', placements });
  }

  send(msg: unknown): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  joinRandom(name: string, matchType: 'casual' | 'rated' = 'casual', uid = ''): void {
    this.send({ type: 'join_random', name, matchType, uid });
  }

  whenOpen(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState === WebSocket.OPEN) return resolve();
      this.ws.on('open', () => resolve());
      this.ws.on('error', reject);
    });
  }

  close(): void {
    this.ws.removeAllListeners();
    this.ws.close();
  }
}

async function waitFor(cond: () => boolean, timeoutMs: number, label: string): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error(`timeout: ${label}`);
    await wait(50);
  }
}

async function testSoloWaitsNoBot(): Promise<void> {
  // 1人だけなら相手が来るまで待機（CPUとはマッチしない）
  const a = new TestClient();
  await a.whenOpen();
  a.joinRandom('ソロ太郎');
  await wait(1200);
  assert.ok(!a.matched, '1人ではマッチしない（CPUと当たらない）');
  a.close();
  console.log('✔ ソロは相手が来るまで待機（CPUとマッチしない）');
}

async function testTwoHumansMatch(): Promise<void> {
  const a = new TestClient();
  const b = new TestClient();
  await Promise.all([a.whenOpen(), b.whenOpen()]);
  a.joinRandom('花子');
  b.joinRandom('次郎');
  await waitFor(() => a.matched && b.matched, 3000, 'two humans matched');
  // 2人とも人間としてマッチ（ボットなしのはず）
  assert.equal(a.lastView!.playerIds.length, 2, '2人でマッチ');
  assert.ok(!a.lastView!.playerNames.some((n) => n.startsWith('BOT')), '人間同士');
  // どちらかが配置待ちのとき deadline が来る
  await waitFor(() => a.sawDeadline || b.sawDeadline, 3000, 'deadline observed');
  await waitFor(() => a.gameOver && b.gameOver, 15000, 'two humans game over');
  assert.deepEqual(a.winners, b.winners, '勝者が一致');
  a.close();
  b.close();
  console.log('✔ 2人マッチ・制限時間通知あり・完走');
}

async function testAfkForcedByTimeout(): Promise<void> {
  // 配置しない人間1人＋自動プレイ1人。AFK側は制限時間でCPU代行され進行する
  let afkMatched = false;
  const afk = new TestClient({ autoPlay: false, onState: () => { afkMatched = true; } });
  const active = new TestClient();
  await Promise.all([afk.whenOpen(), active.whenOpen()]);
  afk.joinRandom('放置マン');
  active.joinRandom('まじめ');
  await waitFor(() => afkMatched && active.matched, 3000, 'afk matched');
  // afkは一切placeしないが、制限時間(1.5s)でCPU代行 → ゲームは進行して終わる
  await waitFor(() => active.gameOver, 20000, 'afk game progresses to end');
  assert.ok(active.gameOver, 'AFKがいても制限時間で進行し完走');
  afk.close();
  active.close();
  console.log('✔ AFKは制限時間でCPU代行され、ゲームが止まらない');
}

async function testReconnect(): Promise<void> {
  // マッチ後に切断 → 猶予内に token で再接続して state を取り戻せる
  const a = new TestClient({ autoPlay: false });
  const b = new TestClient();
  await Promise.all([a.whenOpen(), b.whenOpen()]);
  a.joinRandom('復帰太郎');
  b.joinRandom('相方');
  await waitFor(() => a.matched && !!a.token, 3000, 'reconnect: matched');
  const token = a.token!;
  // 切断（猶予600msより十分早く再接続する）
  a.ws.removeAllListeners();
  a.ws.close();
  await wait(150);
  // 新しい接続で再接続
  const a2 = new TestClient({ autoPlay: true });
  await a2.whenOpen();
  let rejoined = false;
  a2.ws.on('message', () => {});
  a2.send({ type: 'reconnect', token });
  await waitFor(() => a2.matched || a2.gameOver, 3000, 'reconnect: state restored');
  rejoined = a2.matched;
  assert.ok(rejoined, '再接続で state を復元');
  await waitFor(() => a2.gameOver || b.gameOver, 20000, 'reconnect: game over');
  a2.close();
  b.close();
  console.log('✔ 切断 → token 再接続で復帰し完走');
}

async function testRatedMatchUpdatesRating(): Promise<void> {
  // レート対戦の2人が完走 → 双方に rating 通知。初期1000・ゼロサム・勝者が上昇。
  const a = new TestClient();
  const b = new TestClient();
  await Promise.all([a.whenOpen(), b.whenOpen()]);
  a.joinRandom('レート太郎', 'rated', 'uid-a');
  b.joinRandom('レート花子', 'rated', 'uid-b');
  await waitFor(() => a.matched && b.matched, 3000, 'rated matched');
  assert.equal(a.lastView!.playerIds.length, 2, 'レートも人間2人でマッチ');
  await waitFor(() => a.gameOver && b.gameOver, 15000, 'rated game over');
  await waitFor(() => !!a.ratingMsg && !!b.ratingMsg, 3000, 'rating通知');
  assert.equal(a.ratingMsg!.before, 1000, '初期レート1000');
  assert.equal(b.ratingMsg!.before, 1000, '初期レート1000');
  assert.equal(a.ratingMsg!.delta + b.ratingMsg!.delta, 0, 'レート変動はゼロサム');
  assert.notEqual(a.ratingMsg!.delta, 0, '勝敗がつけば変動する');
  const winnerIsA = a.winners?.includes(a.playerId!) ?? false;
  if (winnerIsA) assert.ok(a.ratingMsg!.delta > 0, '勝者はレート上昇');
  a.close();
  b.close();
  console.log('✔ レート対戦: 完走で双方レート更新（初期1000・ゼロサム）');
}

async function testCasualAndRatedCrossMatch(): Promise<void> {
  // カジュアル廃止: 旧クライアント(casual)と新クライアント(rated)が同一キューでマッチし、
  // 双方レート扱いになる（population をひとつに集約してマッチ不成立を防ぐ）。
  const a = new TestClient();
  const b = new TestClient();
  await Promise.all([a.whenOpen(), b.whenOpen()]);
  a.joinRandom('旧casual', 'casual', 'uid-c');
  b.joinRandom('新rated', 'rated', 'uid-d');
  await waitFor(() => a.matched && b.matched, 3000, 'casual×rated が同一キューでマッチ');
  await waitFor(() => a.gameOver && b.gameOver, 18000, 'cross-match game over');
  await waitFor(() => !!a.ratingMsg && !!b.ratingMsg, 3000, 'casualも含めレート通知');
  assert.equal(a.ratingMsg!.delta + b.ratingMsg!.delta, 0, 'レート変動はゼロサム');
  a.close();
  b.close();
  console.log('✔ 旧casual×新rated が同一キューでマッチし双方レート更新');
}

async function main(): Promise<void> {
  await import('./index.js');
  await wait(300); // サーバー起動待ち

  await testSoloWaitsNoBot();
  await testTwoHumansMatch();
  await testAfkForcedByTimeout();
  await testReconnect();
  await testRatedMatchUpdatesRating();
  await testCasualAndRatedCrossMatch();

  console.log('\nすべてのマッチングテスト成功');
  process.exit(0);
}

main().catch((e) => {
  console.error('✖', e);
  process.exit(1);
});
