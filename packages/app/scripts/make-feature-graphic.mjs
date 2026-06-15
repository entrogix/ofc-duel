// Google Play フィーチャーグラフィック（1024×500）を生成する
// 使い方: node scripts/make-feature-graphic.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(root, '../../store');
fs.mkdirSync(outDir, { recursive: true });

const W = 1024;
const H = 500;
const suits = [
  { g: '♠', c: '#1c1c1c' },
  { g: '♥', c: '#c0392b' },
  { g: '♦', c: '#1565c0' },
  { g: '♣', c: '#2e7d32' },
];

// 左にカード列、右にロゴテキストを配置した横長バナー
const chipW = 92;
const chipH = 124;
const gap = 14;
const chipsStartX = 70;
const chipsY = H / 2 - chipH / 2;
const chips = suits
  .map((s, i) => {
    const x = chipsStartX + i * (chipW + gap);
    const rot = (i - 1.5) * 4;
    return `
    <g transform="rotate(${rot} ${x + chipW / 2} ${chipsY + chipH / 2})">
      <rect x="${x}" y="${chipsY}" width="${chipW}" height="${chipH}" rx="12" fill="#faf7ef" stroke="#2e2a22" stroke-width="3"/>
      <text x="${x + chipW / 2}" y="${chipsY + chipH * 0.66}" font-size="68" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" fill="${s.c}">${s.g}</text>
    </g>`;
  })
  .join('');

const textX = 600;
const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="felt" cx="40%" cy="40%" r="80%">
      <stop offset="0%" stop-color="#11553f"/>
      <stop offset="100%" stop-color="#062017"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#felt)"/>
  ${chips}
  <text x="${textX}" y="225" font-size="120" font-family="Arial Black, Arial, sans-serif" font-weight="900" fill="#d4af37" letter-spacing="8">OFC</text>
  <g transform="translate(${textX + 5} 290) skewX(-10)">
    <rect x="0" y="0" width="240" height="62" rx="6" fill="#b71c1c" stroke="#ffd700" stroke-width="4"/>
    <text x="120" y="46" font-size="40" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-style="italic" fill="#ffffff" letter-spacing="4">DUEL</text>
  </g>
  <text x="${textX - 40}" y="400" font-size="21" font-family="Arial, sans-serif" fill="#b8c4bd">オープンフェイス・チャイニーズポーカー</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(path.join(outDir, 'feature-graphic.png'));
console.log('feature-graphic.png generated at', outDir);
