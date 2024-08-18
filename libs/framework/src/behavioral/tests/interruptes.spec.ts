import { expect, describe, it } from 'bun:test'
import { bProgram } from '../b-program.js'
import { sync, loop } from '../rules-function.js'

describe('interrupt', () => {
  const addHot = loop(
    sync({ waitFor: 'add', interrupt: ['terminate'] }),
    sync({ request: { type: 'hot' } }),
  )
  it('should not interrupt', () => {
    const actual: string[] = []
    const { rules, trigger, feedback } = bProgram()
    rules.set({addHot})
    feedback({
      hot() {
        actual.push('hot')
      },
    })
    trigger({ type: 'add' })
    trigger({ type: 'add' })
    trigger({ type: 'add' })
    expect(actual).toEqual(['hot', 'hot', 'hot'])
    expect(rules.has('addHot')).toBe(true)
  })
  it('should interrupt', () => {
    const actual: string[] = []
    const { rules, trigger, feedback } = bProgram()
    rules.set({addHot})
    feedback({
      hot() {
        actual.push('hot')
      },
    })
    trigger({ type: 'add' })
    trigger({ type: 'add' })
    trigger({ type: 'terminate' })
    trigger({ type: 'add' })
    expect(actual).toEqual(['hot', 'hot'])
    expect(rules.has('addHot')).toBe(false)
  })
})
