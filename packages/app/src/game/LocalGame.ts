import { chooseCpuPlacementWithDiscard, GameEngine, Placement, PlayerGameView, PlayerState, viewFor } from '../../../shared/src';

export const HUMAN_ID = 'me';

// このストリートでCPUが置く枚数（残り1枚は捨て）
function placeCountFor(p: PlayerState, street: number): number {
  if (p.inFantasy) return 13;
  return [5, 4, 4][street];
}

// CPU対戦（ヘッズアップ・1枚捨て）: エンジンをアプリ内で回すクライアント
export class LocalGame {
  private engine: GameEngine;
  private listener: ((view: PlayerGameView) => void) | null = null;

  // ヘッズアップ固定（自分 + CPU 1人）。cpuCount は後方互換のため受けるが常に1人
  constructor(playerName: string) {
    this.engine = new GameEngine([
      { id: HUMAN_ID, name: playerName || 'あなた' },
      { id: 'cpu0', name: 'CPU', isCpu: true },
    ]);
    this.pumpCpu();
  }

  onView(cb: (view: PlayerGameView) => void): void {
    this.listener = cb;
    this.emit();
  }

  private emit(): void {
    this.listener?.(viewFor(this.engine.state, HUMAN_ID));
  }

  // CPUが置けるだけ置く（人間がFL中はストリートが自動で進むためループ）
  private pumpCpu(): void {
    const s = this.engine.state;
    let guard = 0;
    while (s.phase === 'placing' && s.players.some((p) => p.isCpu && !p.submitted) && guard++ < 20) {
      for (const p of s.players) {
        if (p.isCpu && !p.submitted) {
          const { placements } = chooseCpuPlacementWithDiscard(p.board, p.dealt, placeCountFor(p, s.street));
          this.engine.submitPlacement(p.id, placements);
        }
      }
    }
  }

  submit(placements: Placement[]): void {
    this.engine.submitPlacement(HUMAN_ID, placements);
    this.pumpCpu();
    this.emit();
  }

  nextHand(): void {
    this.engine.nextHand();
    this.pumpCpu();
    this.emit();
  }
}
