import { Card } from './cards';
import { GameState, HandHistoryRecord, HandResultInfo, Phase } from './engine';
import { Board, emptyBoard } from './royalties';

// プレイヤーに見せてよい情報だけを抜き出したビュー。
// - 他人の現ストリートの配置は全員確定まで見えない → 確定済みボードのみ公開
// - FL中プレイヤーのボードは精算まで非公開（枚数のみ）
export interface OpponentView {
  id: string;
  name: string;
  chips: number;
  board: Board; // FL中は空（hiddenCounts参照）
  discards: Card[]; // 公開済みの捨て札（前ストリートまで／精算時は全て）
  hiddenFantasy: boolean;
  placedCount: number; // FL中に何枚置いたか等の進捗表示用
  submitted: boolean;
  inFantasy: boolean;
  isDealer: boolean;
}

export interface SelfView {
  id: string;
  name: string;
  chips: number;
  board: Board;
  discards: Card[]; // 自分がこのハンドで捨てたカード
  dealt: Card[];
  needPlace: number; // このストリートで配置する枚数（= dealt - 1。残り1枚は自動的に捨て札）
  submitted: boolean;
  inFantasy: boolean;
  isDealer: boolean;
}

// 閲覧者視点に変換済みのハンド履歴エントリ
export interface HandHistoryEntry {
  handNumber: number;
  myNet: number;
  myChipsAfter: number;
  oppNet: number;
  oppChipsAfter: number;
  fantasyEntered: boolean; // 自分がFL突入
  fantasyStayed: boolean;  // 自分がFL継続
}

export interface PlayerGameView {
  you: SelfView;
  opponents: OpponentView[];
  phase: Phase;
  street: number;
  handNumber: number;
  remainingHands: number; // FL延長を除いた残りハンド数（現在のハンドを含む）
  result: HandResultInfo | null; // hand_result / game_over 時のみ
  winners: string[] | null;
  playerIds: string[]; // 採点結果のindex解決用（全プレイヤーのID順）
  playerNames: string[];
  boards: Board[] | null; // 精算時のみ全ボード公開
  history: HandHistoryEntry[]; // 精算済みハンドの履歴（古い順）
}

function boardCount(b: Board): number {
  return b.front.length + b.middle.length + b.back.length;
}

function toHandHistoryEntry(rec: HandHistoryRecord, meIndex: number, myId: string): HandHistoryEntry {
  const oppIndex = meIndex === 0 ? 1 : 0;
  return {
    handNumber: rec.handNumber,
    myNet: rec.net[meIndex],
    myChipsAfter: rec.chipsAfter[meIndex],
    oppNet: rec.net[oppIndex],
    oppChipsAfter: rec.chipsAfter[oppIndex],
    fantasyEntered: rec.fantasyEntered.includes(myId),
    fantasyStayed: rec.fantasyStayed.includes(myId),
  };
}

export function viewFor(state: GameState, playerId: string): PlayerGameView {
  const meIndex = state.players.findIndex((p) => p.id === playerId);
  if (meIndex < 0) throw new Error(`unknown player: ${playerId}`);
  const me = state.players[meIndex];
  const revealAll = state.phase === 'hand_result' || state.phase === 'game_over';

  const opponents: OpponentView[] = state.players
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => i !== meIndex)
    .map(({ p, i }) => {
      const hide = p.inFantasy && !revealAll;
      // 同時公開ルール: 精算時以外は「公開済み（前ストリートまで）」の盤面だけ見せる
      const visibleBoard = revealAll ? p.board : p.revealBoard;
      return {
        id: p.id,
        name: p.name,
        chips: p.chips,
        board: hide ? emptyBoard() : visibleBoard,
        discards: revealAll ? p.discards : p.revealDiscards,
        hiddenFantasy: hide,
        placedCount: boardCount(visibleBoard),
        submitted: p.submitted,
        inFantasy: p.inFantasy,
        isDealer: i === state.dealerIndex,
      };
    });

  return {
    you: {
      id: me.id,
      name: me.name,
      chips: me.chips,
      board: me.board,
      discards: me.discards,
      dealt: me.dealt,
      needPlace: me.dealt.length > 0 ? me.dealt.length - 1 : 0,
      submitted: me.submitted,
      inFantasy: me.inFantasy,
      isDealer: meIndex === state.dealerIndex,
    },
    opponents,
    phase: state.phase,
    street: me.street, // 各プレイヤー自身のストリート（FL絡みハンドでは相手と非同期に進むため）
    handNumber: state.handNumber,
    remainingHands: Math.max(0, state.targetHands - state.handNumber + 1),
    result: revealAll ? state.lastResult : null,
    winners: state.winners,
    playerIds: state.players.map((p) => p.id),
    playerNames: state.players.map((p) => p.name),
    boards: revealAll ? state.players.map((p) => p.board) : null,
    history: state.history.map((rec) => toHandHistoryEntry(rec, meIndex, me.id)),
  };
}
