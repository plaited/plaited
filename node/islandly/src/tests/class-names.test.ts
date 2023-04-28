import { assertEquals } from '../../dev-deps.js'
import { classNames } from '../mod.js'

Deno.test('classNames()', () => {
  assertEquals(classNames('class-1', 'class-2'), 'class-1 class-2')
})

Deno.test('classNames(): falsey', () => {
  const condtionTrue = true
  const conditionFalse = false
  const actual = classNames(
    'class-1',
    conditionFalse && 'class-2',
    condtionTrue && 'class-3'
  )
  assertEquals(actual, 'class-1 class-3')
})
