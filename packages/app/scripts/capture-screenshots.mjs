// ストア用スクリーンショットを Web版(localhost:8081)から撮影する
// iPhone 6.7"相当 1290×2796（viewport 430×932 @ deviceScaleFactor 3）
// 事前に `npx expo start`（Web）を起動しておくこと
// 使い方: node scripts/capture-screenshots.mjs
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const require = createRequire('C:/Users/owner/Entrogix Works/products/manga-sale-today/');
const puppeteer = require('puppeteer');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(root, '../../store/screenshots');
fs.mkdirSync(outDir, { recursive: true });

const URL = 'http://localhost:8081';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickByText(page, text, { nth = 0 } = {}) {
  const box = await page.evaluate((args) => {
    const { text, nth } = args;
    const all = Array.from(document.querySelectorAll('div, span, a'));
    // テキストが一致し、かつ最も内側（子に同テキストを含まない）要素を集める
    const matches = all.filter((el) => {
      const t = (el.textContent || '').trim();
      if (!t.includes(text)) return false;
      const childMatch = Array.from(el.children).some((c) => (c.textContent || '').includes(text));
      return !childMatch;
    });
    const el = matches[nth];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, { text, nth });
  if (!box) throw new Error(`text not found: ${text}`);
  await page.mouse.click(box.x, box.y);
}

async function shoot(page, name) {
  await page.screenshot({ path: path.join(outDir, name) });
  console.log('  📸', name);
}

// トレイの一番左のカード（白いカード面 = #faf7ef / rgb(250,247,239)）を選択 → 指定の行へ配置
async function placeCards(page, plan) {
  for (const row of plan) {
    const card = await page.evaluate(() => {
      const faces = Array.from(document.querySelectorAll('div')).filter((el) => {
        const r = el.getBoundingClientRect();
        const bg = getComputedStyle(el).backgroundColor;
        return bg === 'rgb(250, 247, 239)' && r.top > 640 && r.width >= 44 && r.width <= 66;
      });
      faces.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
      const el = faces[0];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (!card) throw new Error('トレイのカードが見つかりません');
    await page.mouse.click(card.x, card.y); // 選択
    await sleep(250);
    await clickByText(page, row); // 行へ配置
    await sleep(450);
  }
}

async function main() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 3 });

  console.log('→ open', URL);
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(2500); // Metroバンドル＋初回描画＋アニメ待ち

  // 01 タイトル
  await shoot(page, '01-title.png');

  // タイトルをタップ → ホーム
  await page.mouse.click(215, 466);
  await sleep(1500);
  await shoot(page, '02-home.png');

  // あそびかた → 盤面図解
  await clickByText(page, 'あそびかた');
  await sleep(1500);
  await shoot(page, '03-rules.png');
  // 戻る
  await clickByText(page, '戻る');
  await sleep(1000);

  // CPU対戦 → ゲーム画面。カードを実際に配置して見栄えのある盤面を作る
  await clickByText(page, 'CPU対戦');
  await sleep(3000); // 配り演出待ち
  // バックに3枚・ミドルに2枚配置（残り1枚は自動で捨て札）
  await placeCards(page, ['バック', 'バック', 'バック', 'ミドル', 'ミドル']);
  await sleep(800);
  await shoot(page, '04-game.png');

  await browser.close();
  console.log('✅ screenshots saved to', outDir);
}

main().catch((e) => { console.error(e); process.exit(1); });
