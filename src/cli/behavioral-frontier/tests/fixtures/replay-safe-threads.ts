import { sync, thread } from '../../../../behavioral.ts'

const onType = (type: string) => ({ type })

/**
 * Replay-safe fixture with a reachable deadlock after selecting A.
 */
export const createThreads = () => ({
  chooseA: thread([sync({ request: { type: 'A' } })], true),
  chooseB: thread([sync({ request: { type: 'B' } })], true),
  deadlockAfterA: thread([sync({ waitFor: onType('A') }), sync({ block: onType('B') })], true),
})

export default createThreads
