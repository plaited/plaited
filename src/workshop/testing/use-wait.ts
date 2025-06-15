import type { Trigger } from '../../behavioral/b-program.js'
import { wait } from '../../utils/wait.js'

export const WAIT = 'WAIT'

export const useWait = (trigger: Trigger) => (ms: number) => {
  trigger({ type: WAIT, detail: ms })
  return wait(ms)
}
