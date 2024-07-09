import { usePostMessage } from './use-post-message.js'
import { bProgram } from '../behavioral/b-program.js'
import { DefineWorker } from './types.js'

export const defineWorker: DefineWorker = (callback, { publicEvents, targetOrigin, devtool }) => {
  const { feedback, ...rest } = bProgram(devtool)
  const send = usePostMessage({
    trigger: rest.trigger,
    publicEvents,
    targetOrigin,
  })
  const actions = callback({ ...rest, send })
  feedback(actions)
}
