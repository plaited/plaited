import type { Trigger } from '../../behavioral/b-program.js'
import { wait } from '../../utils/wait.js'
import type { WaitDetails } from './testing.types.js'

export const WAIT = 'wait'

export const useWait = (trigger: Trigger) => (ms: number) => {
  trigger<WaitDetails>({ type: WAIT, detail: [ms] })
  return wait(ms)
}
