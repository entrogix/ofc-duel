import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { getSettings } from './settings';

// SE: Kenney「Casino Audio」(CC0)
// BGM通常: Joth「Bossa Nova (8bit Bossa)」(CC0) / BGMフィーバー: Joth「Porkymon Battle Theme」(CC0)
const SE_SOURCES = {
  select: require('../assets/sounds/select.m4a'),
  place: require('../assets/sounds/place.m4a'),
  deal: require('../assets/sounds/deal.m4a'),
  shuffle: require('../assets/sounds/shuffle.m4a'),
  confirm: require('../assets/sounds/confirm.m4a'),
  chips: require('../assets/sounds/chips.m4a'),
  win: require('../assets/sounds/win.m4a'),
} as const;

const BGM_SOURCES = {
  normal: require('../assets/sounds/bgm.mp3'),
  fever: require('../assets/sounds/bgm_fever.mp3'),
} as const;

export type SeName = keyof typeof SE_SOURCES;
export type BgmName = keyof typeof BGM_SOURCES;

setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});

const players: Partial<Record<SeName, AudioPlayer>> = {};
const bgms: Partial<Record<BgmName, AudioPlayer>> = {};
let currentBgm: BgmName | null = null;

// Web: タブが非表示になったらBGMを止め、戻ったら（設定がONなら）再開する
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('visibilitychange', () => {
    try {
      if (!currentBgm) return;
      if (document.hidden) bgms[currentBgm]?.pause();
      else if (getSettings().bgmOn) bgms[currentBgm]?.play();
    } catch {}
  });
}

export function playSe(name: SeName): void {
  if (!getSettings().seOn) return;
  try {
    let p = players[name];
    if (!p) {
      p = createAudioPlayer(SE_SOURCES[name]);
      p.volume = 0.8;
      players[name] = p;
    }
    p.seekTo(0);
    p.play();
  } catch {
    // Webの自動再生制限などは無視
  }
}

export function startBgm(track: BgmName = 'normal'): void {
  try {
    if (currentBgm === track) {
      if (getSettings().bgmOn) bgms[track]?.play();
      return;
    }
    if (currentBgm) bgms[currentBgm]?.pause();
    let p = bgms[track];
    if (!p) {
      p = createAudioPlayer(BGM_SOURCES[track]);
      p.loop = true;
      p.volume = track === 'fever' ? 0.22 : 0.18;
      bgms[track] = p;
    }
    p.seekTo(0);
    currentBgm = track;
    if (getSettings().bgmOn) p.play();
  } catch {}
}

export function stopBgm(): void {
  try {
    if (currentBgm) bgms[currentBgm]?.pause();
    currentBgm = null;
  } catch {}
}

// 設定（bgmOn）変更後に呼ぶ。現在のBGMを設定に合わせて再生/停止する。
export function applyAudioSettings(): void {
  try {
    if (!currentBgm) return;
    if (getSettings().bgmOn) bgms[currentBgm]?.play();
    else bgms[currentBgm]?.pause();
  } catch {}
}
