import { dataTarget } from './constants.js'

export const getTargets = (context:ShadowRoot) => (id: string) => {
  return [ ...(context.querySelectorAll(`[${dataTarget}="${id}"]`)) ]
}
