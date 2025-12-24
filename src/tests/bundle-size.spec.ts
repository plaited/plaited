import { expect, test } from 'bun:test'
import path from 'node:path'

test('bElement export footprint < 5.1kb', async () => {
  const plaitedResults = await Bun.build({
    entrypoints: [path.resolve(import.meta.dir, '../main/b-element.ts')],
    minify: true,
  })

  for (const result of plaitedResults.outputs) {
    // Can be consumed as blobs
    const str = await result.text()
    const compressed = Bun.gzipSync(Buffer.from(str))
    const size = compressed.byteLength / 1024
    expect(size).toBeLessThan(5.1)
    console.log(`Plaited minimum size: ${size}kb`)
  }
})

test('main (kitchen sink) export footprint < 7.5kb', async () => {
  const plaitedResults = await Bun.build({
    entrypoints: [path.resolve(import.meta.dir, '../main.ts')],
    minify: true,
  })

  for (const result of plaitedResults.outputs) {
    // Can be consumed as blobs
    const str = await result.text()
    const compressed = Bun.gzipSync(Buffer.from(str))
    const size = compressed.byteLength / 1024
    expect(size).toBeLessThan(7.5)
    console.log(`Plaited minimum size: ${size}kb`)
  }
})
