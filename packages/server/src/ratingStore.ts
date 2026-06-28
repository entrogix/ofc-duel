import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_RATING } from '../../shared/src/index';

// UIDに紐づくレート/戦績の永続ストア。
//
// 永続先は環境変数で切替（コード変更なしで差し替え可能）:
//   - Upstash Redis（REST）… UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN がある時。
//     Render無料枠はディスク揮発で再デプロイのたびにレートが消えるため、外部に逃がす。
//   - ローカルJSONファイル … 上記が無い時（開発・テスト）。OFC_RATING_FILE で場所変更可。
//
// 設計（重要）: 呼び出し側（index.ts）を変えないため**読み取りは全て同期**のまま。
//   起動時に initRatingStore() でバックエンド全体をインメモリ store へロードし、
//   以降の get系は store から同期で返す。書き込みは store を即時更新し、
//   バックエンドへは**非同期 write-through**（fire-and-forget・失敗してもゲームは止めない）。
//   Redisは uid 単位の Hash フィールドに保存するので、1試合の書き込みは変更uidのみで軽い。

export interface MatchRecord {
  at: number; // 終了時刻
  opponent: string; // 相手の表示名
  result: 'win' | 'lose' | 'draw';
  delta: number; // レート変動
  rating: number; // 対局後レート
  mode: string; // 'rated' | 'casual'
}

export interface PlayerStats {
  rating: number;
  games: number;
  wins: number;
  name: string;
  updatedAt: number;
  recent?: MatchRecord[]; // 直近の対戦履歴（新しい順・最大20）
}

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const REDIS_KEY = process.env.OFC_RATING_REDIS_KEY || 'ofc:ratings';
const useRedis = !!(UPSTASH_URL && UPSTASH_TOKEN);

const here = dirname(fileURLToPath(import.meta.url));
const FILE = process.env.OFC_RATING_FILE ?? join(here, '..', 'data', 'ratings.json');

let store: Record<string, PlayerStats> = {};
let loaded = false;
let redisHealthy = false; // 起動時のUpstashロードが成功したか（=認証情報が有効か）

// 現在の永続先（/stats で公開し、Upstashが効いているか即確認できるようにする）
export function storeBackend(): 'redis' | 'file' {
  return useRedis ? 'redis' : 'file';
}

// 永続先が正常か。file は常に true、redis は起動時ロード成功時のみ true。
// /stats で storeOk:false なら UPSTASH の URL/TOKEN を疑う。
export function storeHealthy(): boolean {
  return useRedis ? redisHealthy : true;
}

// ---- Upstash Redis（REST）ヘルパ -------------------------------------------

async function redisCommand(cmd: unknown[]): Promise<any> {
  const res = await fetch(UPSTASH_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}: ${await res.text()}`);
  return res.json(); // { result: ... }
}

async function redisPipeline(cmds: unknown[][]): Promise<void> {
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds),
  });
  if (!res.ok) throw new Error(`Upstash pipeline ${res.status}: ${await res.text()}`);
}

// ---- ロード / 永続化 --------------------------------------------------------

function loadFile(): Record<string, PlayerStats> {
  try {
    if (existsSync(FILE)) return JSON.parse(readFileSync(FILE, 'utf8'));
  } catch {
    // 壊れていたら空から（戦績消失より継続を優先）
  }
  return {};
}

// 起動時に1回呼ぶ（index.ts が listen 前に await）。バックエンド全体をインメモリへ。
export async function initRatingStore(): Promise<void> {
  if (loaded) return;
  if (useRedis) {
    try {
      const { result } = await redisCommand(['HGETALL', REDIS_KEY]);
      const flat: string[] = Array.isArray(result) ? result : [];
      const next: Record<string, PlayerStats> = {};
      for (let i = 0; i + 1 < flat.length; i += 2) {
        try { next[flat[i]] = JSON.parse(flat[i + 1]); } catch { /* 壊れた行は捨てる */ }
      }
      store = next;
      redisHealthy = true;
      console.log(`[ratingStore] Upstash Redis からロード（${Object.keys(store).length} players）`);
    } catch (e) {
      redisHealthy = false;
      console.error(`[ratingStore] Upstash ロード失敗、空で継続: ${(e as Error).message}`);
      store = {};
    }
  } else {
    store = loadFile();
    console.log(`[ratingStore] ローカルファイルからロード（${Object.keys(store).length} players / ${FILE}）`);
  }
  loaded = true;
}

// 変更された uid のみ永続化（fire-and-forget）。引数なしは全件（リセット等）。
function persist(changedUids?: string[]): void {
  if (useRedis) {
    const uids = (changedUids ?? Object.keys(store)).filter((u) => store[u]);
    if (!uids.length) return;
    const cmds = uids.map((u) => ['HSET', REDIS_KEY, u, JSON.stringify(store[u])]);
    redisPipeline(cmds).catch((e) =>
      console.error(`[ratingStore] Upstash 保存失敗（次回更新で再書き込み）: ${(e as Error).message}`));
  } else {
    try {
      mkdirSync(dirname(FILE), { recursive: true });
      writeFileSync(FILE, JSON.stringify(store, null, 2));
    } catch {
      // 書き込み不可（読み取り専用FS等）でもゲーム進行は止めない
    }
  }
}

// ---- 読み取り（全て同期・インメモリから） ----------------------------------

export function getStats(uid: string): PlayerStats {
  return store[uid] ?? { rating: DEFAULT_RATING, games: 0, wins: 0, name: '', updatedAt: 0 };
}

export function getRating(uid: string): number {
  return getStats(uid).rating;
}

// 累計プレイヤー数（1局以上完了したUID数）。/stats の totalPlayers 用。
export function getPlayerCount(): number {
  return Object.keys(store).length;
}

// 指定エポックms以降に対戦したユニークUID数（日次/週次アクティブの近似）。
export function getActiveSince(sinceMs: number): number {
  let n = 0;
  for (const s of Object.values(store)) {
    if (s.updatedAt >= sinceMs) n += 1;
  }
  return n;
}

export interface RankingEntry {
  uid: string;
  name: string;
  rating: number;
  games: number;
  wins: number;
}

// レート上位を返す（1局以上プレイした人間のみ）
export function getTopPlayers(limit: number): RankingEntry[] {
  return Object.entries(store)
    .filter(([, s]) => s.games > 0)
    .map(([uid, s]) => ({ uid, name: s.name || '名無し', rating: s.rating, games: s.games, wins: s.wins }))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit);
}

// 自分の順位（1始まり）。記録がなければ0
export function getRank(uid: string): number {
  if (!uid || !store[uid] || store[uid].games === 0) return 0;
  const myRating = store[uid].rating;
  let rank = 1;
  for (const [other, s] of Object.entries(store)) {
    if (other !== uid && s.games > 0 && s.rating > myRating) rank += 1;
  }
  return rank;
}

export interface ResultEntry {
  uid: string;
  name: string;
  newRating: number;
  won: boolean;
  opponent: string;
  delta: number;
  mode: string;
}

// 1試合の結果を反映して永続化する。レート変動があった人間のみを渡す。
export function recordResults(entries: ResultEntry[]): void {
  if (entries.length === 0) return;
  const now = Date.now();
  const changed: string[] = [];
  for (const e of entries) {
    if (!e.uid) continue;
    const prev = store[e.uid] ?? { rating: DEFAULT_RATING, games: 0, wins: 0, name: '', updatedAt: 0 };
    const record: MatchRecord = {
      at: now,
      opponent: e.opponent,
      result: e.won ? 'win' : e.delta === 0 ? 'draw' : 'lose',
      delta: e.delta,
      rating: e.newRating,
      mode: e.mode,
    };
    const recent = [record, ...(prev.recent ?? [])].slice(0, 20);
    store[e.uid] = {
      rating: e.newRating,
      games: prev.games + 1,
      wins: prev.wins + (e.won ? 1 : 0),
      name: e.name || prev.name,
      updatedAt: now,
      recent,
    };
    changed.push(e.uid);
  }
  persist(changed);
}

// テスト用: ストアを差し替え/初期化する
export function _resetForTest(seed: Record<string, PlayerStats> = {}): void {
  store = seed;
  loaded = true; // テストは init を呼ばずに直接シードするため
}
