import { expect, test } from 'bun:test'
import path from 'node:path'

test('UI export footprint < 7.5kb', async () => {
  const plaitedResults = await Bun.build({
    entrypoints: [path.resolve(import.meta.dir, '../ui.ts')],
    minify: true,
  })

  for (const result of plaitedResults.outputs) {
    const str = await result.text()
    const compressed = Bun.gzipSync(Buffer.from(str))
    const size = compressed.byteLength / 1024
    expect(size).toBeLessThan(7.5)
    console.log(`UI bundle size: ${size}kb`)
  }
})
