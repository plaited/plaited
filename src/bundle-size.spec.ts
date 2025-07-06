import { test, expect } from 'bun:test'
import path from 'path'

test('Main client bundle footprint < 7kb', async () => {
  const plaitedResults = await Bun.build({
    entrypoints: [path.resolve(import.meta.dir, './main.ts')],
    minify: true,
  })
  expect(plaitedResults.outputs.length).toBe(1)
  for (const result of plaitedResults.outputs) {
    // Can be consumed as blobs
    const str = await result.text()
    const compressed = Bun.gzipSync(str)
    const size = compressed.byteLength / 1024
    expect(size).toBeLessThan(7)
    console.log(`Plaited main size: ${size}kb`)
  }
})

test('defineElement export footprint < 5kb', async () => {
  const plaitedResults = await Bun.build({
    entrypoints: [path.resolve(import.meta.dir, './main/define-element.ts')],
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
