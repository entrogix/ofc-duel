// Google Play フィーチャーグラフィック（1024×500）を生成する
// 使い方: node scripts/make-feature-graphic.mjs
// 新ロゴ（金カード2枚 ♠/♥ + OFC/DUELゴールドバッジ + スパークル / 背景#00593b）に準拠
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(root, '../../store');
fs.mkdirSync(outDir, { recursive: true });

const W = 1024;
const H = 500;
const BG = '#00593b';
const GOLD = '#d4af37';
const CARD_BG = '#d4af37';
const CARD_BORDER = '#1a1400';
const SPADE = '#0b3d2e';
const HEART = '#c41a1a';

// === 左側: カード2枚（アイコンと同じ構図） ===
function playingCard({ x, y, rotate, suit, suitColor }) {
  const w = 150;
  const h = 198;
  const cx = x + w / 2;
  const cy = y + h / 2;
  return `
    <g transform="rotate(${rotate} ${cx} ${cy})">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="20" fill="${CARD_BG}" stroke="${CARD_BORDER}" stroke-width="5"/>
      <text x="${x + 16}" y="${y + 40}" font-size="30" font-family="Arial Black, Arial" font-weight="900" fill="${suitColor}">A</text>
      <text x="${x + 17}" y="${y + 66}" font-size="24" font-family="Arial" fill="${suitColor}">${suit}</text>
      <text x="${cx}" y="${cy + 30}" font-size="84" text-anchor="middle" font-family="Arial" fill="${suitColor}">${suit}</text>
      <g transform="rotate(180 ${x + w - 16} ${y + h - 40})">
        <text x="${x + w - 16}" y="${y + h - 40}" font-size="30" font-family="Arial Black, Arial" font-weight="900" fill="${suitColor}">A</text>
        <text x="${x + w - 15}" y="${y + h - 14}" font-size="24" font-family="Arial" fill="${suitColor}">${suit}</text>
      </g>
    </g>`;
}

const leftCard = playingCard({ x: 110, y: 165, rotate: -15, suit: '♠', suitColor: SPADE });
const rightCard = playingCard({ x: 235, y: 150, rotate: 9, suit: '♥', suitColor: HEART });

// スパークル
const sparkles = `
  <text x="95"  y="150" font-size="34" fill="${GOLD}">✦</text>
  <text x="180" y="120" font-size="14" fill="${GOLD}">●</text>
  <text x="90"  y="320" font-size="12" fill="${GOLD}">●</text>
  <text x="430" y="380" font-size="26" fill="${GOLD}">✦</text>
  <text x="400" y="175" font-size="12" fill="${GOLD}">●</text>`;

// === 右側: OFC / DUEL バッジ + サブコピー ===
const textX = 600;
const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  ${sparkles}
  ${leftCard}
  ${rightCard}
  <text x="${textX}" y="235" font-size="128" font-family="Arial Black, Arial" font-weight="900" fill="${GOLD}" letter-spacing="10">OFC</text>
  <rect x="${textX + 4}" y="270" width="248" height="70" rx="8" fill="${CARD_BORDER}" stroke="${GOLD}" stroke-width="4"/>
  <text x="${textX + 128}" y="320" font-size="46" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" fill="${GOLD}" letter-spacing="10">DUEL</text>
  <text x="${textX}" y="400" font-size="21" font-family="Arial" fill="#cfe3d8">オープンフェイス・チャイニーズポーカー</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(path.join(outDir, 'feature-graphic.png'));
console.log('feature-graphic.png generated at', outDir);
