import { test, expect } from 'bun:test'
import path from 'path'

test('bElement export footprint < 5kb', async () => {
  const plaitedResults = await Bun.build({
    entrypoints: [path.resolve(import.meta.dir, './main/b-element.ts')],
    minify: true,
  })

  for (const result of plaitedResults.outputs) {
    // Can be consumed as blobs
    const str = await result.text()
    const compressed = Bun.gzipSync(Buffer.from(str))
    const size = compressed.byteLength / 1024
    expect(size).toBeLessThan(5)
    console.log(`Plaited minimum size: ${size}kb`)
  }
})
