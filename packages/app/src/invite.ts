import { Share } from 'react-native';

// 招待リンクのスキーム。app.json の expo.scheme と一致させること。
// アプリ未公開のうちは「合言葉」が主導線、リンクは導入済みの相手向けの近道。
// Web/ストアのランディングができたら buildInviteUrl を https://... に差し替えるだけでよい。
export const INVITE_SCHEME = 'ofcduel';

export function buildInviteUrl(code: string): string {
  return `${INVITE_SCHEME}://join?code=${encodeURIComponent(code)}`;
}

export function buildInviteMessage(code: string): string {
  return [
    'OFCデュエルで対戦しよう！🃏',
    '',
    `合言葉: ${code}`,
    'アプリの「フレンド対戦 → 合言葉で参加」で入れるよ。',
    '',
    '▼インストール済みならこのリンクから直接参加',
    buildInviteUrl(code),
  ].join('\n');
}

// ルームの合言葉を端末の共有シート（LINE/X/Discord等）で送る。
// 1人が複数人を呼べる＝獲得が自走するバイラルループの起点。
export async function shareInvite(code: string): Promise<void> {
  if (!code) return;
  try {
    await Share.share({ message: buildInviteMessage(code) });
  } catch {
    // ユーザーがキャンセル等。無視。
  }
}

// 受け取り側: ofcduel://join?code=1234 から4桁の合言葉を取り出す。
export function parseJoinCode(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/[?&]code=(\d{4})/);
  return m ? m[1] : null;
}
