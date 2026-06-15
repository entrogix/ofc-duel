import { Placement, PlayerGameView } from '../../../shared/src';

export interface LobbyInfo {
  code: string | null;
  hostId: string | null;
  players: { id: string; name: string }[];
  inGame: boolean;
}

export interface MatchmakingInfo {
  waiting: number;
  needed: number;
  cancelled?: boolean;
}

export interface JoinedInfo {
  code: string | null;
  playerId: string;
  reconnectToken: string | null;
  random: boolean;
}

export interface RatingResult {
  before: number;
  after: number;
  delta: number;
  rank: string;
}

export interface MatchRow {
  at: number;
  opponent: string;
  result: 'win' | 'lose' | 'draw';
  delta: number;
  rating: number;
  mode: string;
}

export interface StatsInfo {
  rating: number;
  games: number;
  wins: number;
  rank: string;
  recent: MatchRow[];
}

export interface RankingRow {
  place: number;
  name: string;
  rating: number;
  rank: string;
  games: number;
  wins: number;
  you: boolean;
}

export interface RankingInfo {
  top: RankingRow[];
  myPlace: number;
}

export interface OnlineEvents {
  onJoined?: (info: JoinedInfo) => void;
  onLobby?: (lobby: LobbyInfo) => void;
  onState?: (view: PlayerGameView, placeDeadline: number | null) => void;
  onMatchmaking?: (info: MatchmakingInfo) => void;
  onAborted?: (reason: string) => void;
  onReconnectFailed?: () => void;
  onError?: (message: string) => void;
  onClose?: () => void;
  onRating?: (result: RatingResult) => void;
  onStats?: (stats: StatsInfo) => void;
  onRanking?: (info: RankingInfo) => void;
}

// オンライン対戦: サーバー権威。クライアントはメッセージの送受信のみ
export class OnlineClient {
  private ws: WebSocket;
  playerId: string | null = null;
  reconnectToken: string | null = null;
  isRandom = false;
  private events: OnlineEvents;

  constructor(url: string, events: OnlineEvents, onOpen: () => void) {
    this.events = events;
    this.ws = new WebSocket(url);
    this.ws.onopen = onOpen;
    this.ws.onerror = () => events.onError?.('サーバーに接続できません');
    this.ws.onclose = () => events.onClose?.();
    this.ws.onmessage = (e) => {
      const msg = JSON.parse(String(e.data));
      switch (msg.type) {
        case 'joined':
          this.playerId = msg.playerId;
          this.reconnectToken = msg.reconnectToken ?? this.reconnectToken;
          this.isRandom = !!msg.random;
          this.events.onJoined?.({
            code: msg.code ?? null,
            playerId: msg.playerId,
            reconnectToken: msg.reconnectToken ?? null,
            random: !!msg.random,
          });
          break;
        case 'lobby':
          this.events.onLobby?.(msg as LobbyInfo & { type: string });
          break;
        case 'state':
          this.events.onState?.(msg.view as PlayerGameView, msg.placeDeadline ?? null);
          break;
        case 'matchmaking':
          this.events.onMatchmaking?.({ waiting: msg.waiting, needed: msg.needed, cancelled: msg.cancelled });
          break;
        case 'game_aborted':
          this.events.onAborted?.(msg.reason ?? '');
          break;
        case 'reconnect_failed':
          this.events.onReconnectFailed?.();
          break;
        case 'error':
          this.events.onError?.(msg.message ?? 'エラー');
          break;
        case 'rating':
          this.events.onRating?.({ before: msg.before, after: msg.after, delta: msg.delta, rank: msg.rank });
          break;
        case 'stats':
          this.events.onStats?.({ rating: msg.rating, games: msg.games, wins: msg.wins, rank: msg.rank, recent: msg.recent ?? [] });
          break;
        case 'ranking':
          this.events.onRanking?.({ top: msg.top ?? [], myPlace: msg.myPlace ?? 0 });
          break;
      }
    };
  }

  private send(msg: unknown): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  createRoom(name: string, uid: string): void {
    this.send({ type: 'create_room', name, uid });
  }

  joinRoom(code: string, name: string, uid: string): void {
    this.send({ type: 'join_room', code, name, uid });
  }

  joinRandom(name: string, uid: string, matchType: 'casual' | 'rated' = 'casual'): void {
    this.send({ type: 'join_random', name, uid, matchType });
  }

  cancelRandom(): void {
    this.send({ type: 'cancel_random' });
  }

  requestStats(uid: string): void {
    this.send({ type: 'stats', uid });
  }

  requestRanking(uid: string): void {
    this.send({ type: 'ranking', uid });
  }

  reconnect(token: string): void {
    this.send({ type: 'reconnect', token });
  }

  startGame(): void {
    this.send({ type: 'start_game' });
  }

  place(placements: Placement[]): void {
    this.send({ type: 'place', placements });
  }

  nextHand(): void {
    this.send({ type: 'next_hand' });
  }

  dispose(): void {
    this.ws.onclose = null as any;
    this.ws.close();
  }
}
