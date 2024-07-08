import { test, expect } from 'bun:test'
import path from 'path'

test('minimal client bundle footprint < 5.2b', async () => {
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
    expect(size).toBeLessThan(5.2)
    console.log(`Plaited minimum initial size: ${size}kb`)
  }
})

test('maximum client bundle footprint < 7.8kb', async () => {
  const plaitedResults = await Bun.build({
    entrypoints: [path.resolve(import.meta.dir, './kitchen-sink.ts')],
    minify: true,
  })
  expect(plaitedResults.outputs.length).toBe(1)
  for (const result of plaitedResults.outputs) {
    // Can be consumed as blobs
    const str = await result.text()
    const compressed = Bun.gzipSync(Buffer.from(str))
    const size = compressed.byteLength / 1024
    expect(size).toBeLessThan(7.8)
    console.log(`Plaited maximum initial size: ${size}kb`)
  }
})
