import { test, expect } from 'bun:test'

test('minimal client export footprint < 5.5b', async () => {
  const plaited = import.meta.resolveSync('../../src/index.ts')
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
    console.log(`Plaited size: ${size}kb`)
  }
})

test('maximum client export footprint < 8.5kb', async () => {
  const plaited = import.meta.resolveSync('./kitchen-sink.ts')
  const plaitedResults = await Bun.build({
    entrypoints: [plaited],
    minify: true,
  })

  for (const result of plaitedResults.outputs) {
    // Can be consumed as blobs
    const str = await result.text()
    const compressed = Bun.gzipSync(Buffer.from(str))
    const size = compressed.byteLength / 1024
    expect(size).toBeLessThan(8.5)
    console.log(`Plaited size: ${size}kb`)
  }
})
