import AsyncStorage from '@react-native-async-storage/async-storage';

// 端末ごとの永続ユーザーID。
// 表示名（プレイヤー名）は自由に変えられるが、このUIDは一度発行したら変わらない。
// 将来のレート対戦・戦績は「名前」ではなく「UID」に紐付けるため、必ずUIDで本人を追えるようにする。
const KEY = 'ofc.playerUid';
let cached: string | null = null;

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// 起動時に1回呼んでおく。保存済みUIDがあれば返し、なければ生成して永続化する。
export async function getPlayerUid(): Promise<string> {
  if (cached) return cached;
  try {
    let id = await AsyncStorage.getItem(KEY);
    if (!id) {
      id = uuidv4();
      await AsyncStorage.setItem(KEY, id);
    }
    cached = id;
    return id;
  } catch {
    // ストレージ不可時はセッション限りの一時IDで継続
    cached = cached ?? uuidv4();
    return cached;
  }
}

// 同期的に取得（getPlayerUid を一度呼んだ後に使う）。未取得なら空文字。
export function getCachedPlayerUid(): string {
  return cached ?? '';
}
