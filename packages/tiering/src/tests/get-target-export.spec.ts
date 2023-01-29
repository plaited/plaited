import test from 'ava'
import { getTargetExport } from '../get-target-export.js'

test('getTargetExport()',  t => {
  t.is(getTargetExport('home/user/workspace/src'),`home/user/workspace/src/index.ts`)
})
