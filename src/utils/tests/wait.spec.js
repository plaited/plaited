import {assert} from '@esm-bundle/chai'
import {wait} from '..'

it('wait()', async () => {
  await wait(20)
  assert.ok(true)
})
