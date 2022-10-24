import { assert } from '@esm-bundle/chai'
import { classNames } from '../'

it('classNames()', () => {
  assert.equal(classNames('class-1', 'class-2'), 'class-1 class-2')
})

it('classNames(): falsey', () => {
  const condtionTrue = true
  const conditionFalse = false
  const actual = classNames(
    'class-1',
    conditionFalse && 'class-2',
    condtionTrue && 'class-3'
  )
  assert.equal(actual, 'class-1 class-3')
})
