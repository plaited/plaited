import { expect, describe, it } from 'bun:test'
import { bProgram } from '../b-program.js'
import { sync, point } from '../sync.js'

describe('interrupt', () => {
  const addHot = sync([
    point({ waitFor: 'add', interrupt: ['terminate'] }),
    point({ request: { type: 'hot' } })
  ], true)
  
  it('should not interrupt', () => {
    const actual: string[] = []
    const { bThreads, trigger, useFeedback } = bProgram()
    bThreads.set({addHot})
    useFeedback({
      hot() {
        actual.push('hot')
      },
    })
    trigger({ type: 'add' })
    trigger({ type: 'add' })
    trigger({ type: 'add' })
    expect(actual).toEqual(['hot', 'hot', 'hot'])
    expect(bThreads.has('addHot')).toEqual({running: false, pending: true})
  })
  it('should interrupt', () => {
    const actual: string[] = []
    const { bThreads, trigger, useFeedback } = bProgram()
    bThreads.set({addHot})
    useFeedback({
      hot() {
        actual.push('hot')
      },
    })
    trigger({ type: 'add' })
    trigger({ type: 'add' })
    trigger({ type: 'terminate' })
    trigger({ type: 'add' })
    expect(actual).toEqual(['hot', 'hot'])
    expect(bThreads.has('addHot')).toEqual({running: false, pending: false})
  })
})
