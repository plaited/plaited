import { assert } from '@esm-bundle/chai'
import { dataTrigger } from '..'

it('dataTrigger()', () =>{
  assert.equal(
    dataTrigger({
      click:'thing',
      focus: 'it',
    }),
    'data-trigger="click->thing focus->it"'
  )
})
