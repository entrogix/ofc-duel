import { randomUUID } from 'crypto';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { chooseCpuPlacementWithDiscard, chooseCpuPlacementWithDiscardSkilled, computeRatingChanges, computeRatingVsBot, DEFAULT_RATING, GameEngine, Placement, PlayerState, randomBotName, rankFor, RATING_FLOOR, skillForRating, viewFor } from '../../shared/src/index';
import { getActiveSince, getPlayerCount, getRank, getStats, getTopPlayers, recordResults } from './ratingStore';

// OFCデュエル対戦サーバー（サーバー権威）
//
// 対戦モード:
//   ルームコード対戦 … create_room / join_room / start_game（ホスト操作・人間のみ・時間無制限）
//   ランダムマッチ   … join_random（自動マッチ・CPU補充あり・配置制限時間あり・自動進行）
//
// client→server: create_room / join_room / start_game / place / next_hand
//               / join_random / cancel_random / reconnect
// server→client: joined / lobby / state / matchmaking / game_aborted / reconnect_failed / error

const PORT = Number(process.env.PORT ?? 8787);

// タイミング定数（ms）。テストや運用調整のため環境変数で上書き可能
const envMs = (name: string, def: number) => Number(process.env[name] ?? def);
const PLACE_LIMIT_MS = envMs('OFC_PLACE_LIMIT_MS', 30000);    // 通常ストリートの配置制限時間
const FL_PLACE_LIMIT_MS = envMs('OFC_FL_PLACE_LIMIT_MS', 90000); // FLは13枚配置のため3倍
const RESULT_ADVANCE_MS = envMs('OFC_RESULT_ADVANCE_MS', 8000); // 精算→次ハンドの自動進行
const RECONNECT_GRACE_MS = envMs('OFC_RECONNECT_GRACE_MS', 45000); // 切断後の再接続猶予
const BOT_PLACE_DELAY_MS = envMs('OFC_BOT_PLACE_DELAY_MS', 600); // ボット/代行配置の自然な間
const BOT_BACKFILL_MS = envMs('OFC_BOT_BACKFILL_MS', 15000); // この時間人間と当たらなければCPU補充
const BOT_RATING_JITTER = envMs('OFC_BOT_RATING_JITTER', 60); // ボット割当レートの±ゆらぎ
const NEWBIE_GAMES = envMs('OFC_NEWBIE_GAMES', 5); // この対局数未満は新人扱い（ボットを弱める）
const NEWBIE_HANDICAP = envMs('OFC_NEWBIE_HANDICAP', 80); // 新人戦でボットを弱めるレート幅

interface Seat {
  playerId: string; // ルーム内の一時ID
  uid: string; // 端末の永続ユーザーID（将来のレート/戦績の紐付けキー。ボットは空）
  name: string; // 表示名（変更可能）
  isBot: boolean;
  ws: WebSocket | null; // null = ボット or 切断中
  disconnectedAt: number | null;
  reconnectToken: string;
  graceTimer: NodeJS.Timeout | null;
  botRating?: number; // CPU補充ボットの割当レート（人間のレート計算に使う。切断ボットは持たない）
  botSkill?: number; // CPU補充ボットの強度（skillForRating。未設定なら最適手で代行）
}

interface Room {
  id: string;
  code: string | null; // ランダムマッチは null
  isRandom: boolean;
  rated: boolean; // レート対戦か（ランダムマッチのrated枠のみtrue）
  ratingApplied: boolean; // game_over時のレート精算を二重に行わないためのフラグ
  hostId: string | null; // ランダムマッチは null（サーバー主導）
  seats: Map<string, Seat>; // playerId -> Seat（挿入順 = 着席順）
  engine: GameEngine | null;
  placeDeadlines: Map<string, number>; // playerId -> epoch ms。プレイヤーごとの配置制限時刻
  timers: { place?: NodeJS.Timeout; result?: NodeJS.Timeout };
}

const rooms = new Map<string, Room>(); // roomId -> Room
const codeIndex = new Map<string, string>(); // code -> roomId
const tokenIndex = new Map<string, { roomId: string; playerId: string }>();
const wsIndex = new Map<WebSocket, { roomId: string; playerId: string }>();

let nextId = 1;
const newPlayerId = () => `u${nextId++}`;

// ---- マッチングキュー -------------------------------------------------------

interface QueueEntry {
  ws: WebSocket;
  name: string;
  uid: string;
  playerId: string;
  token: string;
  matchType: string; // 旧プロトコル互換用。カジュアル廃止後は全てレート扱い（tryMatchでは未使用）
  backfillTimer?: NodeJS.Timeout; // 15秒人間と当たらなければCPU補充するタイマー
}
let queue: QueueEntry[] = [];

function broadcastQueue(): void {
  for (const e of queue) {
    send(e.ws, { type: 'matchmaking', waiting: queue.length, needed: 2 });
  }
}

function joinRandom(ws: WebSocket, rawName: string, uid: string, matchType: string): void {
  if (queue.some((e) => e.ws === ws) || wsIndex.has(ws)) return; // 二重登録防止
  const name = sanitizeName(rawName);
  const playerId = newPlayerId();
  const token = randomUUID();
  const entry: QueueEntry = { ws, name, uid: String(uid || ''), playerId, token, matchType: matchType === 'rated' ? 'rated' : 'casual' };
  queue.push(entry);
  send(ws, { type: 'joined', playerId, reconnectToken: token, random: true });
  tryMatch();
  // 人間と即マッチしなかった（まだキューに残っている）なら、15秒後にCPU補充する
  if (queue.includes(entry)) {
    entry.backfillTimer = setTimeout(() => backfillWithBot(entry), BOT_BACKFILL_MS);
  }
  broadcastQueue();
}

function clearBackfill(e: QueueEntry): void {
  if (e.backfillTimer) {
    clearTimeout(e.backfillTimer);
    e.backfillTimer = undefined;
  }
}

function leaveQueue(ws: WebSocket): void {
  const before = queue.length;
  for (const e of queue) if (e.ws === ws) clearBackfill(e);
  queue = queue.filter((e) => e.ws !== ws);
  if (queue.length !== before) broadcastQueue();
}

// ランダムマッチは「人間 vs 人間」を最優先（カジュアルは廃止・全てレート扱い）。
// 人間が2人揃えば即マッチ。揃わない待機者は backfillWithBot が15秒後にCPUと当てる。
function tryMatch(): void {
  while (queue.length >= 2) {
    const picked = queue.slice(0, 2);
    const pickedSet = new Set(picked);
    queue = queue.filter((e) => !pickedSet.has(e));
    for (const e of picked) clearBackfill(e); // マッチ成立＝CPU補充タイマー解除
    const room = createRoom({ isRandom: true, rated: true });
    for (const e of picked) {
      addSeat(room, { playerId: e.playerId, uid: e.uid, name: e.name, ws: e.ws, token: e.token, isBot: false });
    }
    startGame(room);
  }
}

// 15秒待っても人間と当たらなかった待機者をCPU（較正ボット）と対戦させる。
// ボットは人間と同じ命名規則（randomBotName）で名付け、見分けがつかないようにする。
// ボットの割当レートを人間のレート付近に置き、その強度（skill）を較正して期待勝率≒0.5に近づける。
function backfillWithBot(entry: QueueEntry): void {
  if (!queue.includes(entry)) return; // 既にマッチ済み/キャンセル済み
  queue = queue.filter((e) => e !== entry);
  clearBackfill(entry);
  broadcastQueue();
  if (entry.ws.readyState !== WebSocket.OPEN) return; // 切断済みなら何もしない

  const room = createRoom({ isRandom: true, rated: true });
  addSeat(room, { playerId: entry.playerId, uid: entry.uid, name: entry.name, ws: entry.ws, token: entry.token, isBot: false });

  // ボットのレートと強度を決める（人間のレートに較正）。新人はやや弱める（ウェルカム曲線）。
  const stats = entry.uid ? getStats(entry.uid) : { rating: DEFAULT_RATING, games: 0 };
  const humanRating = stats.rating ?? DEFAULT_RATING;
  const jitter = Math.round((Math.random() * 2 - 1) * BOT_RATING_JITTER);
  const handicap = stats.games < NEWBIE_GAMES ? NEWBIE_HANDICAP : 0;
  const botRating = Math.max(RATING_FLOOR, humanRating + jitter - handicap);

  const botSeat = addSeat(room, { playerId: newPlayerId(), uid: '', name: randomBotName(), ws: null, isBot: true });
  botSeat.botRating = botRating;
  botSeat.botSkill = skillForRating(botRating);

  startGame(room);
}

// ---- ルーム/席 --------------------------------------------------------------

function createRoom(opts: { isRandom: boolean; code?: string | null; rated?: boolean }): Room {
  const room: Room = {
    id: randomUUID(),
    code: opts.code ?? null,
    isRandom: opts.isRandom,
    rated: opts.rated ?? false,
    ratingApplied: false,
    hostId: null,
    seats: new Map(),
    engine: null,
    placeDeadlines: new Map(),
    timers: {},
  };
  rooms.set(room.id, room);
  if (room.code) codeIndex.set(room.code, room.id);
  return room;
}

function addSeat(
  room: Room,
  opts: { playerId: string; uid?: string; name: string; ws: WebSocket | null; token?: string; isBot: boolean },
): Seat {
  const seat: Seat = {
    playerId: opts.playerId,
    uid: opts.uid ?? '',
    name: opts.name,
    isBot: opts.isBot,
    ws: opts.ws,
    disconnectedAt: null,
    reconnectToken: opts.token ?? randomUUID(),
    graceTimer: null,
  };
  room.seats.set(seat.playerId, seat);
  tokenIndex.set(seat.reconnectToken, { roomId: room.id, playerId: seat.playerId });
  if (opts.ws) wsIndex.set(opts.ws, { roomId: room.id, playerId: seat.playerId });
  if (!room.hostId && !opts.isBot) room.hostId = seat.playerId;
  return seat;
}


function destroyRoom(room: Room): void {
  clearTimers(room);
  for (const seat of room.seats.values()) {
    if (seat.graceTimer) clearTimeout(seat.graceTimer);
    tokenIndex.delete(seat.reconnectToken);
    if (seat.ws) wsIndex.delete(seat.ws);
  }
  if (room.code) codeIndex.delete(room.code);
  rooms.delete(room.id);
}

function clearTimers(room: Room): void {
  if (room.timers.place) {
    clearTimeout(room.timers.place);
    room.timers.place = undefined;
  }
  if (room.timers.result) {
    clearTimeout(room.timers.result);
    room.timers.result = undefined;
  }
  room.placeDeadlines.clear();
}

function makeCode(): string {
  // 合言葉は4桁の数字（クライアントは数字テンキーで入力する）
  let code = '';
  do {
    code = Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join('');
  } while (codeIndex.has(code));
  return code;
}

function sanitizeName(raw: unknown): string {
  return String(raw || 'プレイヤー').slice(0, 12);
}

// ---- 送信ヘルパ -------------------------------------------------------------

function send(ws: WebSocket, msg: unknown): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function sendError(ws: WebSocket, message: string): void {
  send(ws, { type: 'error', message });
}

function lobbyPayload(room: Room) {
  return {
    type: 'lobby',
    code: room.code,
    hostId: room.hostId,
    players: [...room.seats.values()].map((s) => ({ id: s.playerId, name: s.name })),
    inGame: room.engine !== null && room.engine.state.phase !== 'game_over',
  };
}

function broadcastLobby(room: Room): void {
  for (const seat of room.seats.values()) {
    if (seat.ws) send(seat.ws, lobbyPayload(room));
  }
}

function broadcastState(room: Room): void {
  if (!room.engine) return;
  for (const seat of room.seats.values()) {
    if (!seat.ws) continue;
    send(seat.ws, {
      type: 'state',
      view: viewFor(room.engine.state, seat.playerId),
      placeDeadline: room.placeDeadlines.get(seat.playerId) ?? null,
    });
  }
}

// ---- 進行制御（ボット代行・制限時間・自動進行） ----------------------------

const TARGET_HANDS = process.env.OFC_TARGET_HANDS ? Number(process.env.OFC_TARGET_HANDS) : undefined;

function startGame(room: Room): void {
  room.engine = new GameEngine(
    [...room.seats.values()].map((s) => ({ id: s.playerId, name: s.name })),
    { targetHands: TARGET_HANDS },
  );
  broadcastState(room);
  advance(room);
}

function advance(room: Room): void {
  const engine = room.engine;
  if (!engine) return;
  // result タイマーはここで常にキャンセル。place タイマーは placing ブロック内で管理
  if (room.timers.result) { clearTimeout(room.timers.result); room.timers.result = undefined; }
  const s = engine.state;

  if (s.phase === 'placing') {
    // place タイマーをいったんキャンセル（この後必要なら再スケジュール）
    if (room.timers.place) { clearTimeout(room.timers.place); room.timers.place = undefined; }

    // 未配置のボット/切断者を1人ずつ代行（少し間を置いて自然に見せる）
    for (const p of s.players) {
      if (p.submitted) continue;
      const seat = room.seats.get(p.id);
      if (!seat) continue;
      if (seat.isBot || seat.ws === null) {
        scheduleAutoPlace(room, p.id);
        return; // 代行後に再度 advance されるので一旦抜ける
      }
    }

    // ランダムマッチのみ制限時間を課す（FL: 90秒、通常ストリート: 30秒）
    if (room.isRandom) {
      let nextDeadline = Infinity;
      for (const p of s.players) {
        if (p.submitted) {
          room.placeDeadlines.delete(p.id); // 確定済みのデッドラインは削除
          continue;
        }
        const seat = room.seats.get(p.id);
        if (!seat || seat.isBot || seat.ws === null) continue;
        // 初回のみデッドラインをセット（再 advance でリセットしない）
        if (!room.placeDeadlines.has(p.id)) {
          const limit = p.inFantasy ? FL_PLACE_LIMIT_MS : PLACE_LIMIT_MS;
          room.placeDeadlines.set(p.id, Date.now() + limit);
        }
        nextDeadline = Math.min(nextDeadline, room.placeDeadlines.get(p.id)!);
      }
      if (nextDeadline !== Infinity) {
        const delay = Math.max(0, nextDeadline - Date.now());
        room.timers.place = setTimeout(() => checkDeadlines(room), delay);
        broadcastState(room); // 各プレイヤーに自分のデッドラインを通知
      }
    }
  } else if (s.phase === 'hand_result') {
    room.placeDeadlines.clear(); // ストリート終了でデッドラインをリセット
    // ランダムマッチ・ルームコード問わず一定時間で自動的に次ハンドへ（スタック防止）
    room.timers.result = setTimeout(() => {
      if (!room.engine || room.engine.state.phase !== 'hand_result') return;
      room.engine.nextHand();
      broadcastState(room);
      advance(room);
    }, RESULT_ADVANCE_MS);
  } else if (s.phase === 'game_over') {
    room.placeDeadlines.clear();
    applyRating(room);
  }
}

// 期限切れのプレイヤーを強制配置する（forcePlace の代替。各自の deadline を個別に判定）
function checkDeadlines(room: Room): void {
  const engine = room.engine;
  if (!engine || engine.state.phase !== 'placing') return;
  room.timers.place = undefined;
  const now = Date.now();
  let forcedAny = false;
  for (const p of engine.state.players) {
    if (p.submitted) continue;
    const deadline = room.placeDeadlines.get(p.id);
    if (deadline != null && now >= deadline) {
      try {
        const { placements } = chooseCpuPlacementWithDiscard(p.board, p.dealt, placeCountFor(p));
        engine.submitPlacement(p.id, placements);
        forcedAny = true;
      } catch { /* 競合は無視 */ }
      room.placeDeadlines.delete(p.id);
    }
  }
  if (forcedAny) broadcastState(room);
  advance(room);
}

// レート対戦の終局時、最終チップから人間どうしのレート変動を算出・永続化し、
// 各人に自分の変動（before/after/delta/rank）を通知する。1卓につき1回だけ。
function applyRating(room: Room): void {
  if (!room.rated || room.ratingApplied || !room.engine) return;
  const s = room.engine.state;
  if (s.phase !== 'game_over') return;
  room.ratingApplied = true;

  // CPU補充戦（接続中の人間1 vs 較正ボット1）: ボットの割当レートに対して人間のレートを動かす。
  // 切断でボット化した席は uid を持つので除外され、この分岐には入らない（従来の人間戦パスへ）。
  const connectedHumans = [...room.seats.values()].filter((st) => !st.isBot && st.uid && st.ws);
  const backfillBots = [...room.seats.values()].filter((st) => st.isBot && !st.uid && typeof st.botRating === 'number');
  if (connectedHumans.length === 1 && backfillBots.length === 1) {
    const hSeat = connectedHumans[0];
    const bSeat = backfillBots[0];
    const hp = s.players.find((p) => p.id === hSeat.playerId);
    const bp = s.players.find((p) => p.id === bSeat.playerId);
    if (!hp || !bp) return;
    const before = getStats(hSeat.uid).rating;
    const change = computeRatingVsBot(
      { uid: hSeat.uid, rating: before, chips: hp.chips },
      { rating: bSeat.botRating!, chips: bp.chips },
    );
    if (!change) return;
    const winners = new Set(s.winners ?? []);
    recordResults([
      {
        uid: change.uid,
        name: hSeat.name,
        newRating: change.after,
        won: winners.has(hSeat.playerId),
        opponent: bSeat.name, // 人間と同じ名前体系なので戦績上はボットと分からない
        delta: change.delta,
        mode: 'rated',
      },
    ]);
    if (hSeat.ws) {
      send(hSeat.ws, { type: 'rating', before: change.before, after: change.after, delta: change.delta, rank: rankFor(change.after).label });
    }
    return;
  }

  const players = s.players.map((p) => {
    const seat = room.seats.get(p.id);
    const uid = seat && !seat.isBot ? seat.uid : '';
    return { uid, rating: uid ? getStats(uid).rating : 0, chips: p.chips };
  });
  const changes = computeRatingChanges(players);
  if (changes.size === 0) return; // 人間が1人以下＝変動なし

  const winners = new Set(s.winners ?? []);
  recordResults(
    [...changes.values()].map((c) => {
      const seat = [...room.seats.values()].find((st) => st.uid === c.uid);
      const opp = [...room.seats.values()].find((st) => st.uid !== c.uid);
      return {
        uid: c.uid,
        name: seat?.name ?? '',
        newRating: c.after,
        won: seat ? winners.has(seat.playerId) : false,
        opponent: opp?.name ?? '相手',
        delta: c.delta,
        mode: room.rated ? 'rated' : 'casual',
      };
    }),
  );

  for (const seat of room.seats.values()) {
    const c = changes.get(seat.uid);
    if (!seat.ws || !c) continue;
    send(seat.ws, {
      type: 'rating',
      before: c.before,
      after: c.after,
      delta: c.delta,
      rank: rankFor(c.after).label,
    });
  }
}

// このプレイヤーがこのストリートで置く枚数（残りは捨て）。engine と同じルール。
// 配り枚数 = 置き枚数 + 1 なので dealt から一意に決まり、各自のストリートに依存しない。
function placeCountFor(p: PlayerState): number {
  return Math.max(0, p.dealt.length - 1);
}

function scheduleAutoPlace(room: Room, playerId: string): void {
  const engine = room.engine;
  if (!engine) return;
  const p = engine.state.players.find((x) => x.id === playerId);
  if (!p || p.submitted) return;
  const seat = room.seats.get(playerId);
  // CPU補充ボットは較正強度で打つ。切断代行など強度未設定の席は従来どおり最適手。
  const { placements } = seat && typeof seat.botSkill === 'number'
    ? chooseCpuPlacementWithDiscardSkilled(p.board, p.dealt, placeCountFor(p), seat.botSkill)
    : chooseCpuPlacementWithDiscard(p.board, p.dealt, placeCountFor(p));
  setTimeout(() => {
    if (!room.engine) return;
    const pp = room.engine.state.players.find((x) => x.id === playerId);
    if (!pp || pp.submitted) return;
    try {
      room.engine.submitPlacement(playerId, placements);
    } catch {
      // 競合（既に進んだ等）は無視
    }
    broadcastState(room);
    advance(room);
  }, BOT_PLACE_DELAY_MS);
}

// ---- 接続ハンドラ -----------------------------------------------------------

const PRIVACY_POLICY_HTML = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>プライバシーポリシー｜OFCデュエル</title>
<style>
  body { font-family: -apple-system, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif;
         max-width: 720px; margin: 0 auto; padding: 24px; line-height: 1.8; color: #1c1c1c; }
  h1 { font-size: 1.5rem; border-bottom: 2px solid #d4af37; padding-bottom: 8px; }
  h2 { font-size: 1.15rem; margin-top: 2rem; color: #0b3d2e; }
  a { color: #1565c0; }
  .meta { color: #666; font-size: .9rem; }
</style>
</head>
<body>
<h1>プライバシーポリシー（OFCデュエル）</h1>
<p class="meta">最終更新日: 2026-06-14</p>
<p>「OFCデュエル」（以下「本アプリ」）は、Entrogix（個人開発者）が提供するカードゲームアプリです。本アプリにおける利用者情報の取り扱いについて、以下のとおり定めます。</p>
<h2>1. アプリが自ら収集する情報</h2>
<p><strong>本アプリ自体がアカウント情報や個人情報を収集することはありません。</strong></p>
<ul>
  <li>アカウント登録は不要です</li>
  <li>ゲームの進行状況は端末内にのみ保存されます</li>
  <li>オンライン対戦時に入力するプレイヤー名とゲームの手札情報は、対戦の進行のためだけにサーバーへ送信され、対戦終了後に破棄されます。個人を特定する情報とは紐付けません</li>
</ul>
<h2>2. 広告について</h2>
<p>本アプリは Google AdMob による広告（バナー広告・全画面動画広告）を表示します。AdMob は広告配信・効果測定のために、広告識別子（iOSのIDFA / AndroidのAdID）、おおよその位置情報、デバイス情報等を収集・利用する場合があります。</p>
<ul>
  <li>取り扱いの詳細: <a href="https://policies.google.com/technologies/partner-sites">Googleが広告でデータを使用する方法</a> / <a href="https://support.google.com/admob/answer/6128543">AdMobのプライバシー</a></li>
  <li>iOSでは初回起動時にトラッキング許可（ATT）のダイアログを表示します。拒否した場合は、パーソナライズされない広告のみが表示されます</li>
  <li>本アプリは現在、広告以外の目的でこれらの情報を収集・保存しません</li>
</ul>
<h2>3. 情報の第三者提供</h2>
<p>法令に基づく場合を除き、利用者の情報を第三者に提供することはありません。</p>
<h2>4. お問い合わせ</h2>
<ul>
  <li>開発者: Entrogix</li>
  <li>連絡先: entrogix.works@gmail.com</li>
</ul>
<h2>5. 改定</h2>
<p>本ポリシーは必要に応じて改定されることがあります。重要な変更がある場合は、アプリ内またはストアページでお知らせします。</p>
</body>
</html>`;

// HTTPサーバーを内包（Render等のヘルスチェックに200を返す）。WSはupgradeで処理
const httpServer = createServer((req, res) => {
  if (req.url === '/privacy-policy' || req.url === '/privacy-policy.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(PRIVACY_POLICY_HTML);
    return;
  }
  // オンライン人数の計測用スナップショット（誰でも閲覧可・読み取り専用・個人情報なし）
  if (req.url === '/stats' || req.url === '/stats.json') {
    const DAY = 86400000;
    let inGame = 0;
    let liveRooms = 0;
    for (const room of rooms.values()) {
      if (!room.engine) continue;
      liveRooms += 1;
      for (const seat of room.seats.values()) {
        if (!seat.isBot && seat.ws !== null) inGame += 1;
      }
    }
    const body = {
      ts: new Date().toISOString(),
      connected: wss.clients.size,   // 接続中のソケット数（メニュー含む）
      inQueue: queue.length,         // マッチ待ち人数
      inGame,                        // 対戦中の人間プレイヤー数
      activeRooms: liveRooms,        // 進行中の卓数
      totalPlayers: getPlayerCount(),// 累計UID（1局以上完了）
      activeToday: getActiveSince(Date.now() - DAY), // 直近24hにプレイしたUID数（揮発注意）
    };
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('OFCデュエル server is running');
});
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg: any;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return sendError(ws, '不正なメッセージです');
    }
    try {
      handleMessage(ws, msg);
    } catch (e) {
      sendError(ws, e instanceof Error ? e.message : String(e));
    }
  });

  ws.on('close', () => handleClose(ws));
});

function handleClose(ws: WebSocket): void {
  leaveQueue(ws);
  const idx = wsIndex.get(ws);
  wsIndex.delete(ws);
  if (!idx) return;
  const room = rooms.get(idx.roomId);
  if (!room) return;
  const seat = room.seats.get(idx.playerId);
  if (!seat) return;
  seat.ws = null;

  if (!room.engine) {
    // ゲーム開始前（ロビー）: 席を抜けてロビー更新（従来挙動）
    room.seats.delete(seat.playerId);
    tokenIndex.delete(seat.reconnectToken);
    const humans = [...room.seats.values()].filter((s) => !s.isBot);
    if (humans.length === 0) {
      destroyRoom(room);
      return;
    }
    if (seat.playerId === room.hostId) room.hostId = humans[0].playerId;
    broadcastLobby(room);
    return;
  }

  // ゲーム中: 席は残し、再接続猶予中はCPU代行。猶予切れでボット化
  seat.disconnectedAt = Date.now();
  seat.graceTimer = setTimeout(() => {
    seat.graceTimer = null;
    if (seat.ws !== null) return; // 既に復帰済み
    seat.isBot = true; // 以後はボットとして自動進行
    const humans = [...room.seats.values()].filter((s) => !s.isBot && s.ws);
    if (humans.length === 0) {
      destroyRoom(room);
    }
  }, RECONNECT_GRACE_MS);

  // 自分の手番だった場合に止まらないよう進行を促す
  advance(room);
}

function requireSeat(ws: WebSocket): { room: Room; seat: Seat } {
  const idx = wsIndex.get(ws);
  const room = idx ? rooms.get(idx.roomId) : undefined;
  if (!room || !idx) throw new Error('ルームに参加していません');
  const seat = room.seats.get(idx.playerId);
  if (!seat) throw new Error('ルームに参加していません');
  return { room, seat };
}

function handleMessage(ws: WebSocket, msg: any): void {
  switch (msg.type) {
    case 'create_room': {
      const room = createRoom({ isRandom: false, code: makeCode() });
      const playerId = newPlayerId();
      const seat = addSeat(room, { playerId, uid: String(msg.uid || ''), name: sanitizeName(msg.name), ws, isBot: false });
      send(ws, { type: 'joined', code: room.code, playerId, reconnectToken: seat.reconnectToken });
      broadcastLobby(room);
      break;
    }
    case 'join_room': {
      const code = String(msg.code || '').trim();
      const roomId = codeIndex.get(code);
      const room = roomId ? rooms.get(roomId) : undefined;
      if (!room) throw new Error('ルームが見つかりません');
      if (room.engine && room.engine.state.phase !== 'game_over') throw new Error('ゲーム進行中のため参加できません');
      if (room.seats.size >= 2) throw new Error('満員です（ヘッズアップ2人制）');
      const playerId = newPlayerId();
      const seat = addSeat(room, { playerId, uid: String(msg.uid || ''), name: sanitizeName(msg.name), ws, isBot: false });
      send(ws, { type: 'joined', code, playerId, reconnectToken: seat.reconnectToken });
      broadcastLobby(room);
      break;
    }
    case 'join_random': {
      joinRandom(ws, msg.name, String(msg.uid || ''), String(msg.matchType || 'casual'));
      break;
    }
    case 'stats': {
      const uid = String(msg.uid || '');
      const st = getStats(uid);
      send(ws, {
        type: 'stats',
        rating: st.rating,
        games: st.games,
        wins: st.wins,
        rank: rankFor(st.rating).label,
        recent: st.recent ?? [],
      });
      break;
    }
    case 'ranking': {
      const uid = String(msg.uid || '');
      const top = getTopPlayers(20).map((e, i) => ({
        place: i + 1,
        name: e.name,
        rating: e.rating,
        rank: rankFor(e.rating).label,
        games: e.games,
        wins: e.wins,
        you: !!uid && e.uid === uid,
      }));
      send(ws, { type: 'ranking', top, myPlace: getRank(uid) });
      break;
    }
    case 'cancel_random': {
      leaveQueue(ws);
      send(ws, { type: 'matchmaking', waiting: 0, needed: 2, cancelled: true });
      break;
    }
    case 'reconnect': {
      const loc = tokenIndex.get(String(msg.token || ''));
      const room = loc ? rooms.get(loc.roomId) : undefined;
      const seat = room && loc ? room.seats.get(loc.playerId) : undefined;
      if (!room || !seat) {
        send(ws, { type: 'reconnect_failed' });
        break;
      }
      if (seat.graceTimer) {
        clearTimeout(seat.graceTimer);
        seat.graceTimer = null;
      }
      if (seat.ws) wsIndex.delete(seat.ws);
      seat.ws = ws;
      seat.disconnectedAt = null;
      seat.isBot = false; // 人間が復帰
      wsIndex.set(ws, { roomId: room.id, playerId: seat.playerId });
      send(ws, {
        type: 'joined',
        code: room.code,
        playerId: seat.playerId,
        reconnectToken: seat.reconnectToken,
        random: room.isRandom,
      });
      if (room.engine) broadcastState(room);
      else broadcastLobby(room);
      break;
    }
    case 'start_game': {
      const { room, seat } = requireSeat(ws);
      if (room.isRandom) throw new Error('ランダムマッチは自動で開始します');
      if (seat.playerId !== room.hostId) throw new Error('開始できるのはホストだけです');
      if (room.seats.size < 2) throw new Error('2人以上必要です');
      if (room.engine && room.engine.state.phase !== 'game_over') throw new Error('すでにゲーム中です');
      startGame(room);
      break;
    }
    case 'place': {
      const { room, seat } = requireSeat(ws);
      if (!room.engine) throw new Error('ゲームが開始されていません');
      const placements = (msg.placements ?? []) as Placement[];
      room.engine.submitPlacement(seat.playerId, placements);
      broadcastState(room);
      advance(room);
      break;
    }
    case 'next_hand': {
      const { room, seat } = requireSeat(ws);
      if (!room.engine) throw new Error('ゲームが開始されていません');
      if (room.engine.state.phase !== 'hand_result') break; // 既に進行済みなら無視
      if (room.isRandom) {
        // 誰でも早送りできる（自動進行の前倒し）
        clearTimers(room);
        room.engine.nextHand();
        broadcastState(room);
        advance(room);
      } else {
        if (seat.playerId !== room.hostId) throw new Error('次のハンドへ進められるのはホストだけです');
        room.engine.nextHand();
        broadcastState(room);
        advance(room);
      }
      break;
    }
    default:
      throw new Error(`不明なメッセージ: ${msg.type}`);
  }
}

httpServer.listen(PORT, () => {
  console.log(`OFCデュエル対戦サーバー起動: ws://localhost:${PORT}`);
});
