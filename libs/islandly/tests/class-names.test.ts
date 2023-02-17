import { assertEquals } from '../../test-deps.ts'
import { classNames } from '../mod.ts'

Deno.test('classNames()', () => {
  assertEquals(classNames('class-1', 'class-2'), 'class-1 class-2')
})

Deno.test('classNames(): falsey', () => {
  const condtionTrue = true
  const conditionFalse = false
  const actual = classNames(
    'class-1',
    conditionFalse && 'class-2',
    condtionTrue && 'class-3',
  )
  assertEquals(actual, 'class-1 class-3')
})
