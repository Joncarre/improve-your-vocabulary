// @ts-check
// Rasterises public/icon.svg into the PNG icons iOS and the web manifest need.
// Run with `npm run icons` after editing the SVG; the PNGs are committed.
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const SOURCE = fileURLToPath(new URL('../public/icon.svg', import.meta.url))
const BACKGROUND = '#0A0A0C'

// The monogram already sits inside the maskable safe zone (central 80 %), so one artwork serves
// the regular and the maskable icon. iOS ignores manifest icons and needs an opaque 180 px PNG.
const TARGETS = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
]

for (const { file, size } of TARGETS) {
  const output = fileURLToPath(new URL(`../public/${file}`, import.meta.url))
  await sharp(SOURCE, { density: 288 })
    .resize(size, size)
    .flatten({ background: BACKGROUND })
    .png()
    .toFile(output)
  console.log(`public/${file} (${size} x ${size})`)
}
