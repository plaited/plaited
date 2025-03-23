import { expect, describe, it } from 'bun:test'
import { bProgram, bThread, bSync } from 'plaited/behavioral'

describe('interrupt', () => {
  const addHot = bThread(
    [bSync({ waitFor: 'add', interrupt: ['terminate'] }), bSync({ request: { type: 'hot' } })],
    true,
  )

  it('should not interrupt', () => {
    const actual: string[] = []
    const { bThreads, trigger, useFeedback } = bProgram()
    bThreads.set({ addHot })
    useFeedback({
      hot() {
        actual.push('hot')
      },
    })
    trigger({ type: 'add' })
    trigger({ type: 'add' })
    trigger({ type: 'add' })
    expect(actual).toEqual(['hot', 'hot', 'hot'])
    expect(bThreads.has('addHot')).toEqual({ running: false, pending: true })
  })
  it('should interrupt', () => {
    const actual: string[] = []
    const { bThreads, trigger, useFeedback } = bProgram()
    bThreads.set({ addHot })
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
    expect(bThreads.has('addHot')).toEqual({ running: false, pending: false })
  })
})
