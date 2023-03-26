import { test } from '../test.ts'
import { send } from './comms.ts'

test('send clear', () => {
  send('benchmark-island', { type: 'run' })
})
