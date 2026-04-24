import { describe, expect, test } from 'bun:test'
import { CONNECT_PLAITED_ROUTE } from '../../render/template.constants.ts'
import { bundleController } from '../bundle-controller.ts'

describe('useController', () => {
  test('builds a compact gzipped controller route without inline source maps', async () => {
    const routes = await bundleController()
    const response = routes[CONNECT_PLAITED_ROUTE]

    expect(response).toBeInstanceOf(Response)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-encoding')).toBe('gzip')
    expect(response.headers.get('content-type')).toContain('text/javascript')

    const compressed = new Uint8Array(await response.arrayBuffer())
    const uncompressed = Bun.gunzipSync(compressed)
    const source = new TextDecoder().decode(uncompressed)

    expect(source).toContain('searchParams')
    expect(source).toContain('initialize')
    expect(source).not.toContain('sourceMappingURL')
    expect(compressed.byteLength / 1024).toBeLessThan(30)
  })
})
