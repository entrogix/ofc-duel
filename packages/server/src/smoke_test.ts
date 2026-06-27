// サーバーのスモークテスト: 2クライアントで1ゲーム完走できるか
import WebSocket from 'ws';
import { chooseCpuPlacementWithDiscard } from '../../shared/src/ai';
import type { PlayerGameView } from '../../shared/src/view';

const URL = `ws://localhost:${process.env.PORT ?? 8787}`;

interface Bot {
  ws: WebSocket;
  playerId: string | null;
  name: string;
  isHost: boolean;
  lastView: PlayerGameView | null;
  placedKeys: Set<string>; // hand:street の二重送信ガード
  nextSentKeys: Set<string>;
}

function connect(name: string, isHost: boolean): Bot {
  return { ws: new WebSocket(URL), playerId: null, name, isHost, lastView: null, placedKeys: new Set(), nextSentKeys: new Set() };
}

function send(bot: Bot, msg: unknown): void {
  bot.ws.send(JSON.stringify(msg));
}

async function main(): Promise<void> {
  const host = connect('ホスト太郎', true);
  const guest = connect('ゲスト花子', false);
  let roomCode: string | null = null;
  let finished = 0;

  const done = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('タイムアウト: ゲームが終了しませんでした')), 60000);

    const handle = (bot: Bot) => (raw: WebSocket.RawData) => {
      const msg = JSON.parse(String(raw));
      switch (msg.type) {
        case 'joined':
          bot.playerId = msg.playerId;
          if (bot.isHost) {
            roomCode = msg.code;
            console.log(`ルーム作成: ${roomCode}`);
            send(guest, { type: 'join_room', code: roomCode, name: guest.name });
          }
          break;
        case 'lobby':
          if (bot.isHost && msg.players.length === 2 && !msg.inGame && bot.lastView === null) {
            console.log('2人揃った → ゲーム開始');
            send(bot, { type: 'start_game' });
          }
          break;
        case 'state': {
          const view = msg.view as PlayerGameView;
          bot.lastView = view;
          const key = `${view.handNumber}:${view.street}`;
          if (view.phase === 'placing' && !view.you.submitted && view.you.dealt.length > 0 && !bot.placedKeys.has(key)) {
            bot.placedKeys.add(key);
            // 1枚捨てルール: needPlace 枚だけ配置（残り1枚は自動で捨て札）
            const { placements } = chooseCpuPlacementWithDiscard(view.you.board, view.you.dealt, view.you.needPlace);
            send(bot, { type: 'place', placements });
          } else if (view.phase === 'hand_result' && bot.isHost && !bot.nextSentKeys.has(key)) {
            bot.nextSentKeys.add(key);
            console.log(`hand ${view.handNumber} 精算 chips=[${msg.view.result.chipsAfter.join(',')}]`);
            send(bot, { type: 'next_hand' });
          } else if (view.phase === 'game_over') {
            finished += 1;
            console.log(`${bot.name}: game_over 勝者=${view.winners?.join(',')}`);
            if (finished === 2) {
              clearTimeout(timeout);
              resolve();
            }
          }
          break;
        }
        case 'error':
          clearTimeout(timeout);
          reject(new Error(`サーバーエラー: ${msg.message}`));
          break;
      }
    };

    host.ws.on('message', handle(host));
    guest.ws.on('message', handle(guest));
    host.ws.on('open', () => send(host, { type: 'create_room', name: host.name }));
    host.ws.on('error', reject);
    guest.ws.on('error', reject);
  });

  await done;
  host.ws.close();
  guest.ws.close();
  console.log('スモークテスト成功');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
