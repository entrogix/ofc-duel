import { Card, cardId, newDeck, sameCard, shuffle } from './cards';
import { Board, boardIsComplete, cloneBoard, emptyBoard, evaluateBoard, qualifiesFantasy, Row, ROW_CAPACITY, ROWS, staysFantasy } from './royalties';
import { HandScore, scoreHand } from './scoring';

export type Phase = 'placing' | 'hand_result' | 'game_over';

export interface Placement {
  card: Card;
  row: Row;
}

export interface PlayerState {
  id: string;
  name: string;
  chips: number;
  board: Board; // 確定済み配置（本人とサーバーのみが知る）
  revealBoard: Board; // 他プレイヤーに公開済みの配置（前ストリートまで。同時公開ルール用）
  discards: Card[]; // このハンドで捨てたカード（確定済み・全て）
  revealDiscards: Card[]; // 公開済みの捨て札（前ストリートまで。同時公開用）
  dealt: Card[]; // 現ストリートの手札（配置数+1枚。最後の1枚が自動的に捨て札になる）
  submitted: boolean; // 現ストリートの配置を確定済みか
  street: number; // このプレイヤー自身の現ストリート（0,1,2）。FL中は0で一括配置。FLが絡むハンドでは各自独立に進む
  inFantasy: boolean; // このハンドをFLで進行中
  nextFantasy: boolean; // 次ハンドFL確定
  isCpu: boolean;
}

export interface HandResultInfo {
  score: HandScore;
  fantasyEntered: string[]; // playerId
  fantasyStayed: string[];
  chipsAfter: number[];
}

export interface HandHistoryRecord {
  handNumber: number;
  net: number[];        // players[] インデックス順の増減
  chipsAfter: number[];
  fantasyEntered: string[];
  fantasyStayed: string[];
}

export interface GameState {
  players: PlayerState[];
  deck: Card[];
  dealerIndex: number;
  street: number; // 全体の最大ストリート（表示フォールバック用）。各プレイヤーの進行は player.street を参照
  phase: Phase;
  handNumber: number; // 1始まり
  dealerMovesDone: number; // ディーラーが移動した回数（FL中は移動しない）
  targetHands: number; // 規定ハンド数（これに達するか破産で終了）
  lastResult: HandResultInfo | null;
  history: HandHistoryRecord[]; // 精算済みハンドの履歴（古い順）
  winners: string[] | null; // game_over時
}

export interface EngineOptions {
  startingChips?: number;
  rng?: () => number;
  targetHands?: number; // この規定ハンド数で終了（デフォルト10。1戦5分想定）。破産が先なら破産で終了
}

// 1戦の規定ハンド数。持ち点50とあわせて約5〜9分・実力が出て運の早期終了が少ない設定
// （balance_sim 2026-06-14: 同実力で勝率≈50%、実力差ありで≈90%、破産決着1〜6%）
const DEFAULT_TARGET_HANDS = 6;

// ターボ＋1枚捨て: 各ストリートで「配り枚数 = 置き枚数 + 1」。最後の1枚が自動で捨て札になる。
// 6枚配り→5置き / 5枚配り→4置き / 5枚配り→4置き（計13配置・3枚捨て・16ドロー）
const STREET_DEALS = [6, 5, 5];
const STREET_PLACE = [5, 4, 4];
// FL（ファンタジーランド）: 14枚配り→13置き→1捨て（突入も継続も14枚固定）
const FL_DEAL = 14;
const FL_PLACE = 13;

export class GameEngine {
  state: GameState;
  private rng: () => number;

  constructor(players: { id: string; name: string; isCpu?: boolean }[], opts: EngineOptions = {}) {
    // 捨てありはデッキ供給の都合でヘッズアップ固定（1人16枚×2=32 ≤ 52）
    if (players.length !== 2) throw new Error('ヘッズアップ（2人）専用です');
    this.rng = opts.rng ?? Math.random;
    this.state = {
      players: players.map((p) => ({
        id: p.id,
        name: p.name,
        chips: opts.startingChips ?? 50,
        board: emptyBoard(),
        revealBoard: emptyBoard(),
        discards: [],
        revealDiscards: [],
        dealt: [],
        submitted: false,
        street: 0,
        inFantasy: false,
        nextFantasy: false,
        isCpu: !!p.isCpu,
      })),
      deck: [],
      dealerIndex: 0,
      street: 0,
      phase: 'placing',
      handNumber: 0,
      dealerMovesDone: 0,
      targetHands: opts.targetHands ?? DEFAULT_TARGET_HANDS,
      lastResult: null,
      history: [],
      winners: null,
    };
    this.startHand();
  }

  // このストリートで「置く」枚数（残りの dealt は捨て）。配り枚数 = 置き枚数 + 1。
  private placeCount(p: PlayerState): number {
    return p.inFantasy ? FL_PLACE : STREET_PLACE[p.street];
  }

  private startHand(): void {
    const s = this.state;
    s.handNumber += 1;
    s.street = 0;
    s.phase = 'placing';
    s.deck = shuffle(newDeck(), this.rng);
    for (const p of s.players) {
      p.board = emptyBoard();
      p.revealBoard = emptyBoard();
      p.discards = [];
      p.revealDiscards = [];
      p.dealt = [];
      p.submitted = false;
      p.street = 0;
      p.inFantasy = p.nextFantasy;
      p.nextFantasy = false;
    }
    for (const p of s.players) this.dealToPlayer(p);
  }

  // 1人のプレイヤーに自分の現ストリート（p.street）の手札を配る。
  private dealToPlayer(p: PlayerState): void {
    const s = this.state;
    p.submitted = false;
    // 前ストリートまでの配置・捨て札をここで「公開」する
    p.revealBoard = cloneBoard(p.board);
    p.revealDiscards = p.discards.slice();
    if (p.inFantasy) {
      if (p.street === 0) {
        p.dealt = s.deck.splice(0, FL_DEAL);
      } else {
        // FLプレイヤーは street 0 で一括配置済み
        p.dealt = [];
        p.submitted = true;
      }
    } else {
      p.dealt = s.deck.splice(0, STREET_DEALS[p.street]);
    }
  }

  playerIndex(playerId: string): number {
    const i = this.state.players.findIndex((p) => p.id === playerId);
    if (i < 0) throw new Error(`unknown player: ${playerId}`);
    return i;
  }

  // 現ストリートの手札を配置して確定する。配置しなかった残り1枚は自動的に捨て札になる。
  submitPlacement(playerId: string, placements: Placement[]): void {
    const s = this.state;
    if (s.phase !== 'placing') throw new Error('配置フェーズではありません');
    const p = s.players[this.playerIndex(playerId)];
    if (p.submitted) throw new Error('すでに確定済みです');

    const need = this.placeCount(p);
    if (placements.length !== need) throw new Error(`${need}枚を配置してください（残り1枚は捨て札）`);

    // 配置カードが手札にある・重複なしか
    const used = new Set<string>();
    for (const pl of placements) {
      const id = cardId(pl.card);
      if (used.has(id)) throw new Error(`カード重複: ${id}`);
      if (!p.dealt.some((c) => sameCard(c, pl.card))) throw new Error(`手札にないカード: ${id}`);
      used.add(id);
    }
    // 置かなかったカード（=捨て札）。配り枚数 - 置き枚数 = 1
    const discarded = p.dealt.filter((c) => !used.has(cardId(c)));

    // 容量チェック
    const next: Board = {
      front: p.board.front.slice(),
      middle: p.board.middle.slice(),
      back: p.board.back.slice(),
    };
    for (const pl of placements) {
      next[pl.row].push(pl.card);
      if (next[pl.row].length > ROW_CAPACITY[pl.row]) throw new Error(`${pl.row} が定員超過です`);
    }
    // FLは13枚一括で盤面完成必須
    if (p.inFantasy && !boardIsComplete(next)) throw new Error('FLでは13枚すべてを配置してください');

    p.board = next;
    p.discards = p.discards.concat(discarded);
    p.dealt = [];
    p.submitted = true;
    this.advance();
  }

  private allBoardsComplete(): boolean {
    return this.state.players.every((p) => boardIsComplete(p.board));
  }

  // ストリート進行。
  // - FLが絡むハンド: 各プレイヤーが独立に進む。相手のFL一括配置を待たずに自分のストリートを進められる
  //   （FLボードは精算まで非公開なので、独立進行でも同時公開ルールの公平性は損なわれない）。
  // - 通常ハンド（両者FLでない）: 従来どおりロックステップ（全員submit→全員次へ）で同時公開を維持。
  private advance(): void {
    const s = this.state;
    const handHasFantasy = s.players.some((p) => p.inFantasy);

    if (handHasFantasy) {
      // submit済みで未完成の非FLプレイヤーに、自分の次ストリートを配る（相手を待たない）
      let dealtAny = true;
      while (dealtAny) {
        dealtAny = false;
        for (const p of s.players) {
          if (p.submitted && !p.inFantasy && !boardIsComplete(p.board) && p.street < 2) {
            p.street += 1;
            this.dealToPlayer(p);
            dealtAny = true;
          }
        }
      }
    } else {
      // ロックステップ: 全員submitしたら、未完成の全員に次ストリートを配る
      while (s.players.every((p) => p.submitted) && !this.allBoardsComplete()) {
        for (const p of s.players) {
          if (!boardIsComplete(p.board)) {
            p.street += 1;
            this.dealToPlayer(p);
          }
        }
      }
    }

    s.street = Math.max(...s.players.map((p) => p.street)); // 表示フォールバック用
    if (this.allBoardsComplete()) this.scoreCurrentHand();
  }

  private scoreCurrentHand(): void {
    const s = this.state;
    for (const p of s.players) {
      if (!boardIsComplete(p.board)) throw new Error(`board incomplete: ${p.id}`);
      // 最終ストリートの捨て札も公開対象にする
      p.revealBoard = cloneBoard(p.board);
      p.revealDiscards = p.discards.slice();
    }
    const score = scoreHand(s.players.map((p) => p.board));
    const fantasyEntered: string[] = [];
    const fantasyStayed: string[] = [];
    s.players.forEach((p, i) => {
      p.chips += score.net[i];
      const ev = score.evals[i];
      if (p.inFantasy) {
        if (staysFantasy(ev)) {
          p.nextFantasy = true;
          fantasyStayed.push(p.id);
        }
      } else if (qualifiesFantasy(ev)) {
        p.nextFantasy = true;
        fantasyEntered.push(p.id);
      }
    });
    const chipsAfter = s.players.map((p) => p.chips);
    s.lastResult = { score, fantasyEntered, fantasyStayed, chipsAfter };
    s.history.push({
      handNumber: s.handNumber,
      net: score.net.slice(),
      chipsAfter: chipsAfter.slice(),
      fantasyEntered,
      fantasyStayed,
    });
    s.phase = 'hand_result';

    const bankrupt = s.players.some((p) => p.chips <= 0);
    const anyFantasyNext = s.players.some((p) => p.nextFantasy);
    // 規定ハンド数に到達したら終了（FL予約中はFLを消化してから終わらせる）
    const wouldFinish = !anyFantasyNext && s.handNumber >= s.targetHands;
    if (bankrupt || wouldFinish) {
      s.phase = 'game_over';
      const max = Math.max(...s.players.map((p) => p.chips));
      s.winners = s.players.filter((p) => p.chips === max).map((p) => p.id);
    }
  }

  // hand_result から次ハンドへ
  nextHand(): void {
    const s = this.state;
    if (s.phase !== 'hand_result') throw new Error('精算フェーズではありません');
    const anyFantasyNext = s.players.some((p) => p.nextFantasy);
    if (!anyFantasyNext) {
      s.dealerIndex = (s.dealerIndex + 1) % s.players.length;
      s.dealerMovesDone += 1;
    }
    this.startHand();
  }
}
