import type { Trigger } from '../../behavioral/b-program.js'
import { wait } from '../../utils/wait.js'
import type { WaitDetails } from './testing.types.js'
import { FIXTURE_EVENTS } from './testing.constants.js'

export const useWait = (trigger: Trigger) => (ms: number) => {
  trigger<WaitDetails>({ type: FIXTURE_EVENTS.wait, detail: [ms] })
  return wait(ms)
}
