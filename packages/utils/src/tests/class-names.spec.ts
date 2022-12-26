import test from 'ava'
import { classNames } from '../index.js'

test('classNames()', t => {
  t.is(classNames('class-1', 'class-2'), 'class-1 class-2')
})

test('classNames(): falsey', t => {
  const condtionTrue = true
  const conditionFalse = false
  const actual = classNames(
    'class-1',
    conditionFalse && 'class-2',
    condtionTrue && 'class-3'
  )
  t.is(actual, 'class-1 class-3')
})
