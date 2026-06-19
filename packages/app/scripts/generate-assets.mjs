import sharp from 'sharp';
import { fileURLToPath } from 'url';
import path from 'path';
import { existsSync } from 'fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = (p) => path.join(root, 'assets', p);
const srcPath = path.join(root, 'scripts', 'icon-source.png');

// Android monochrome用（白カード2枚シルエット on 透過）
function monoSvg(s) {
  return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(${s * 0.18} ${s * 0.22}) rotate(-15 ${s * 0.18} ${s * 0.24})">
      <rect width="${s * 0.38}" height="${s * 0.49}" rx="${s * 0.05}" fill="#ffffff"/>
    </g>
    <g transform="translate(${s * 0.42} ${s * 0.22}) rotate(10 ${s * 0.19} ${s * 0.24})">
      <rect width="${s * 0.38}" height="${s * 0.49}" rx="${s * 0.05}" fill="#ffffff"/>
    </g>
  </svg>`;
}

async function main() {
  if (!existsSync(srcPath)) {
    console.error(`❌ ソース画像が見つかりません: ${srcPath}`);
    process.exit(1);
  }

  const src = () => sharp(srcPath);

  // iOS / 汎用アイコン 1024x1024
  await src().resize(1024, 1024).png().toFile(out('icon.png'));
  console.log('✅ icon.png');

  // Android adaptive foreground（セーフゾーン=中央66%に収まるよう余白追加）
  await src()
    .resize(660, 660)
    .extend({ top: 182, bottom: 182, left: 182, right: 182, background: { r: 11, g: 61, b: 46, alpha: 1 } })
    .resize(1024, 1024)
    .png()
    .toFile(out('android-icon-foreground.png'));
  console.log('✅ android-icon-foreground.png');

  // Android adaptive background（無地 #0b3d2e）
  await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 11, g: 61, b: 46, alpha: 1 } },
  }).png().toFile(out('android-icon-background.png'));
  console.log('✅ android-icon-background.png');

  // Android monochrome（白シルエット on 透過）
  await sharp(Buffer.from(monoSvg(1024))).png().toFile(out('android-icon-monochrome.png'));
  console.log('✅ android-icon-monochrome.png');

  // favicon 48x48
  await src().resize(48, 48).png().toFile(out('favicon.png'));
  console.log('✅ favicon.png');

  // スプラッシュ用ロゴ 512x512
  await src().resize(512, 512).png().toFile(out('splash-icon.png'));
  console.log('✅ splash-icon.png');

  console.log('\n🎉 全アセット生成完了');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
