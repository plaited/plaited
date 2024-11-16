import { test, expect } from 'bun:test'
import path from 'path'

test('Maximum client bundle footprint < 7.5kb', async () => {
  const plaitedResults = await Bun.build({
    entrypoints: [path.resolve(import.meta.dir, '../index.ts')],
    minify: true,
  })
  console.log(path.resolve(import.meta.dir, '../index.ts'))
  expect(plaitedResults.outputs.length).toBe(1)
  for (const result of plaitedResults.outputs) {
    // Can be consumed as blobs
    const str = await result.text()
    const compressed = Bun.gzipSync(str)
    const size = compressed.byteLength / 1024
    expect(size).toBeLessThan(7.5)
    console.log(`Plaited main size: ${size}kb`)
  }
})

test('defineTemplate export footprint < 5.5kb', async () => {
  const plaited = import.meta.resolveSync('./minimal.ts')
  const plaitedResults = await Bun.build({
    entrypoints: [plaited],
    minify: true,
  })

  for (const result of plaitedResults.outputs) {
    // Can be consumed as blobs
    const str = await result.text()
    const compressed = Bun.gzipSync(Buffer.from(str))
    const size = compressed.byteLength / 1024
    expect(size).toBeLessThan(5.5)
    console.log(`Plaited minimum size: ${size}kb`)
  }
})
