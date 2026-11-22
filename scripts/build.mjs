import { build } from 'esbuild'
import { cp, rm, writeFile } from 'node:fs/promises'
import { crc32, deflateSync } from 'node:zlib'

await rm('dist', { recursive: true, force: true })
await cp('public', 'dist', { recursive: true })
await build({
  entryPoints: { background: 'src/background.ts', panel: 'src/ui/main.tsx' },
  outdir: 'dist', bundle: true, format: 'esm', minify: true, target: 'chrome116',
  define: { 'process.env.NODE_ENV': '"production"' }, legalComments: 'eof',
})

// Icon: two linked dots on a teal tile.
const size = 128, pixels = Buffer.alloc((size * 4 + 1) * size)
for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
  const dx = Math.max(24 - x, 0, x - 103), dy = Math.max(24 - y, 0, y - 103)
  if (Math.hypot(dx, dy) > 24) continue
  const white = Math.hypot(x - 42, y - 84) < 19 || Math.hypot(x - 86, y - 44) < 19
    || (x >= 42 && x <= 86 && Math.abs(y - (84 - (x - 42) * 40 / 44)) < 7)
  pixels.set(white ? [255, 255, 255, 255] : [15, 118, 110, 255], y * (size * 4 + 1) + 1 + x * 4)
}
const chunk = (type, body) => {
  const head = Buffer.alloc(4), tail = Buffer.alloc(4), payload = Buffer.concat([Buffer.from(type), body])
  head.writeUInt32BE(body.length); tail.writeUInt32BE(crc32(payload))
  return Buffer.concat([head, payload, tail])
}
const header = Buffer.alloc(13)
header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6
await writeFile('dist/icon.png', Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0)),
]))
console.log('Built dist/')
