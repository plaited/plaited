import { test, expect } from 'bun:test'

test('main export footprint < 5.5kb', async () => {
  const plaited = import.meta.resolveSync('../index.ts')
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
