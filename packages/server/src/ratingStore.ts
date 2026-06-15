import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_RATING } from '../../shared/src/index';

// UIDに紐づくレート/戦績の永続ストア（MVP: JSONファイル）。
//
// ⚠️ 本番デプロイ（Render無料枠等）はディスクが揮発するため、再デプロイで消える。
//    本番運用時は OFC_RATING_FILE に永続ボリュームを指すか、外部DBへ差し替える前提。
//    そのための薄いインターフェース（getStats/getRating/recordResults）に閉じてある。

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

const here = dirname(fileURLToPath(import.meta.url));
const FILE = process.env.OFC_RATING_FILE ?? join(here, '..', 'data', 'ratings.json');

let store: Record<string, PlayerStats> = load();

function load(): Record<string, PlayerStats> {
  try {
    if (existsSync(FILE)) return JSON.parse(readFileSync(FILE, 'utf8'));
  } catch {
    // 壊れていたら空から始める（戦績消失より継続を優先）
  }
  return {};
}

function persist(): void {
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(store, null, 2));
  } catch {
    // 書き込み不可（読み取り専用FS等）でもゲーム進行は止めない
  }
}

export function getStats(uid: string): PlayerStats {
  return store[uid] ?? { rating: DEFAULT_RATING, games: 0, wins: 0, name: '', updatedAt: 0 };
}

export function getRating(uid: string): number {
  return getStats(uid).rating;
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
  }
  persist();
}

// テスト用: ストアを差し替え/初期化する
export function _resetForTest(seed: Record<string, PlayerStats> = {}): void {
  store = seed;
}
