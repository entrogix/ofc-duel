// アプリアイコン・スプラッシュ・faviconをSVGから生成する
// 使い方: node scripts/generate-assets.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = (p) => path.join(root, 'assets', p);

// スート4つ（4色デッキ）を並べたカードチップ + OFC + DUEL帯
function iconSvg({ size, pad, withText }) {
  const s = size;
  const suits = [
    { g: '♠', c: '#1c1c1c' },
    { g: '♥', c: '#c0392b' },
    { g: '♦', c: '#1565c0' },
    { g: '♣', c: '#2e7d32' },
  ];
  const chipW = s * 0.17;
  const chipH = s * 0.23;
  const gap = s * 0.025;
  const totalW = chipW * 4 + gap * 3;
  const startX = (s - totalW) / 2;
  const chipY = s * (withText ? 0.2 : 0.28);
  const chips = suits
    .map((suit, i) => {
      const x = startX + i * (chipW + gap);
      return `
      <rect x="${x}" y="${chipY}" width="${chipW}" height="${chipH}" rx="${s * 0.02}" fill="#faf7ef" stroke="#2e2a22" stroke-width="${s * 0.006}"/>
      <text x="${x + chipW / 2}" y="${chipY + chipH * 0.72}" font-size="${chipH * 0.62}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" fill="${suit.c}">${suit.g}</text>`;
    })
    .join('');

  const text = withText
    ? `
      <text x="${s / 2}" y="${s * 0.66}" font-size="${s * 0.21}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" fill="#d4af37" letter-spacing="${s * 0.02}">OFC</text>
      <g transform="translate(${s / 2} ${s * 0.78}) skewX(-10)">
        <rect x="${-s * 0.19}" y="${-s * 0.055}" width="${s * 0.38}" height="${s * 0.105}" rx="${s * 0.012}" fill="#b71c1c" stroke="#ffd700" stroke-width="${s * 0.006}"/>
        <text x="0" y="${s * 0.028}" font-size="${s * 0.062}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-style="italic" fill="#ffffff" letter-spacing="${s * 0.012}">DUEL</text>
      </g>`
    : '';

  return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="felt" cx="50%" cy="38%" r="75%">
        <stop offset="0%" stop-color="#11553f"/>
        <stop offset="100%" stop-color="#072a20"/>
      </radialGradient>
    </defs>
    <rect width="${s}" height="${s}" fill="url(#felt)"/>
    ${chips}
    ${text}
  </svg>`;
}

// Android monochrome（白シルエット）
function monoSvg(s) {
  const chipW = s * 0.17;
  const chipH = s * 0.23;
  const gap = s * 0.025;
  const totalW = chipW * 4 + gap * 3;
  const startX = (s - totalW) / 2;
  const chipY = s * 0.38;
  const chips = Array.from({ length: 4 })
    .map((_, i) => {
      const x = startX + i * (chipW + gap);
      return `<rect x="${x}" y="${chipY}" width="${chipW}" height="${chipH}" rx="${s * 0.02}" fill="#ffffff"/>`;
    })
    .join('');
  return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">${chips}</svg>`;
}

async function main() {
  // iOS/汎用アイコン（文字入りフル）
  await sharp(Buffer.from(iconSvg({ size: 1024, withText: true }))).png().toFile(out('icon.png'));
  // Android adaptive foreground（セーフゾーン考慮で中身は中央66%に収まるよう余白広め）
  await sharp(Buffer.from(iconSvg({ size: 1024, withText: true })))
    .extend({ top: 160, bottom: 160, left: 160, right: 160, background: { r: 7, g: 42, b: 32, alpha: 1 } })
    .resize(1024, 1024)
    .png()
    .toFile(out('android-icon-foreground.png'));
  // Android adaptive background（無地フェルト）
  await sharp(Buffer.from(`<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><rect width="1024" height="1024" fill="#0b3d2e"/></svg>`))
    .png()
    .toFile(out('android-icon-background.png'));
  // Android monochrome
  await sharp(Buffer.from(monoSvg(1024))).png().toFile(out('android-icon-monochrome.png'));
  // favicon
  await sharp(Buffer.from(iconSvg({ size: 1024, withText: false }))).resize(48, 48).png().toFile(out('favicon.png'));
  // スプラッシュ用ロゴ（透過、中央表示用）
  await sharp(Buffer.from(iconSvg({ size: 1024, withText: true })))
    .resize(512, 512)
    .png()
    .toFile(out('splash-icon.png'));
  console.log('assets generated');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
