import { test } from '$rite'
import { Trigger, useMessenger } from '$plaited'

test('useMessenger: with worker', async (t) => {
  const [connect, send] = useMessenger()

  connect.worker(
    'calculator',
    '/use-messenger/test.worker.js',
    true,
  )

  let actual
  const callback: Trigger = (args) => {
    actual = args.detail
  }

  connect('main', callback)

  send('calculator', {
    type: 'calculate',
    detail: { a: 9, b: 10, operation: 'multiply' },
  })
  await t.wait(60)
  t({
    given: 'requesting calculate',
    should: 'update with value',
    actual,
    expected: 90,
  })
})