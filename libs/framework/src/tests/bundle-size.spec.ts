import { test, expect } from 'bun:test'
import path from 'path'

test('minimal client bundle footprint < 6.5b', async () => {
  const plaitedResults = await Bun.build({
    entrypoints: [path.resolve(import.meta.dir, '../../src/index.ts')],
    minify: true,
  })
  expect(plaitedResults.outputs.length).toBe(1)
  for (const result of plaitedResults.outputs) {
    // Can be consumed as blobs
    const str = await result.text()
    const compressed = Bun.gzipSync(Buffer.from(str))
    const size = compressed.byteLength / 1024
    expect(size).toBeLessThan(6.5)
    console.log(`Plaited minimum initial size: ${size}kb`)
  }
})
