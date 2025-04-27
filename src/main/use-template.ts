import type { Query, BoundElement, SelectorMatch } from './plaited.types'
import { assignHelpers, getBindings } from './assign-helpers'
import { P_TARGET } from '../jsx/jsx.constants.js'

export const useTemplate = <T>(el: BoundElement<HTMLTemplateElement>, callback: ($: Query, data: T) => void) => {
  const content = el.content
  const bindings = getBindings(el.getRootNode() as ShadowRoot)
  return (data: T) => {
    const clone = content.cloneNode(true) as DocumentFragment
    callback(
      <T extends Element = Element>(target: string, match: SelectorMatch = '=') =>
        assignHelpers<T>(bindings, clone.querySelectorAll<T>(`[${P_TARGET}${match}"${target}"]`)),
      data,
    )
    return clone
  }
}
