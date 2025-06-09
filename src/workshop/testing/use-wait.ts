import type { Trigger } from '../../behavioral/b-program.js'
import { wait } from '../../utils/wait.js'
import { WAIT } from './testing.constants.js'

export const useWait = (trigger: Trigger) => (ms: number) => {
  trigger({ type: WAIT, detail: ms })
  return wait(ms)
}
