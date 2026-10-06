/**
 * public/icon.svg 로 홈 화면 아이콘 PNG 를 만든다(아이폰은 PNG 만 인식).
 *   npm run icons
 */

import sharp from 'sharp';

const svg = 'public/icon.svg';
const out: [string, number][] = [
  ['public/icon-192.png', 192],
  ['public/icon-512.png', 512],
  ['public/apple-touch-icon.png', 180],
];
for (const [file, size] of out) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(file);
  console.log(`✅ ${file} (${size}px)`);
}
// 안드로이드 "마스크" 아이콘: 가장자리가 잘려도 되게 여백을 둔다
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#7c3aed' } })
  .composite([{ input: await sharp(svg, { density: 384 }).resize(400, 400).png().toBuffer(), gravity: 'center' }])
  .png()
  .toFile('public/icon-maskable-512.png');
console.log('✅ public/icon-maskable-512.png');
