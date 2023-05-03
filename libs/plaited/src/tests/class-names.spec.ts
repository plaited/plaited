import { test } from '@plaited/rite'
import { classNames } from '../index.js'

test('classNames', t => {
  t({
    given: 'two class names',
    should: 'joing them',
    expected:  'class-1 class-2',
    actual: classNames('class-1', 'class-2'),
  })
  const condtionTrue = true
  const conditionFalse = false
  t({
    given: 'truthy and falsy class names',
    should: 'join only truthy',
    expected:  'class-1 class-3',
    actual: classNames(
      'class-1',
      conditionFalse && 'class-2',
      condtionTrue && 'class-3'
    ),
  })
})

