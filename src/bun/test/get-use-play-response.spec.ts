import { test, expect } from 'bun:test'
import { getUsePlayResponse } from '../get-use-play-response.js'
import { trueTypeOf } from '../../utils.js'
import { jsMimeTypes } from '../create-zipped-response.js'

test('getUsePlayResponse', async () => {
  const response = await getUsePlayResponse()
  expect(trueTypeOf(response)).toBe('response')
  const contentType = await response.headers.get('Content-Type')
  expect(contentType).toEqual(jsMimeTypes[0])
  const contentEncoding = await response.headers.get('Content-Encoding')
  expect(contentEncoding).toEqual('gzip')
  const dec = new TextDecoder()
  const buffer = await response.arrayBuffer()
  const uncompressed = Bun.gunzipSync(buffer)
  const str = dec.decode(uncompressed)
  expect(str).toContain('usePlay')
})
