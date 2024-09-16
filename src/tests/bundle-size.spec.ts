import { test, expect } from 'bun:test'
import path from 'path'

test('Maximum client bundle footprint < 8.5kb', async () => {
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
    expect(size).toBeLessThan(8.5)
    console.log(`Plaited minimum initial size: ${size}kb`)
  }
})

test('defineTemplate export footprint < 6kb', async () => {
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
    expect(size).toBeLessThan(6)
    console.log(`Plaited size: ${size}kb`)
  }
})
