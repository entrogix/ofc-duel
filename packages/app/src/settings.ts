import AsyncStorage from '@react-native-async-storage/async-storage';

// アプリ全体の設定。端末に永続化する。
export interface Settings {
  bgmOn: boolean; // BGM
  seOn: boolean; // 効果音
  reduceMotion: boolean; // 演出（アニメ）を減らす
  playerName: string; // 表示名
}

const DEFAULT: Settings = {
  bgmOn: true,
  seOn: true,
  reduceMotion: false,
  playerName: 'あなた',
};

const KEY = 'ofc.settings';
let current: Settings = { ...DEFAULT };
let listeners: Array<() => void> = [];

function notify(): void {
  for (const l of listeners) l();
}

// 起動時に1回呼ぶ
export async function loadSettings(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) current = { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    // 失敗時はデフォルトのまま
  }
  notify();
}

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  AsyncStorage.setItem(KEY, JSON.stringify(current)).catch(() => {});
  notify();
}

// 設定変更を購読（画面の再描画用）
export function subscribeSettings(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}
