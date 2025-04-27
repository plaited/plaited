import type { Query, BoundElement, SelectorMatch } from './plaited.types'
import { assignHelpers, getBindings } from './assign-helpers'
import { P_TARGET } from '../jsx/jsx.constants.js'

export const useTemplate = <T>(el: BoundElement<HTMLTemplateElement>, callback: ($: Query, data: T) => void) => {
  const shadowRoot = el.getRootNode() as ShadowRoot
  const content = el.content
  const $ =
    (el: DocumentFragment) =>
    <T extends Element = Element>(target: string, match: SelectorMatch = '=') =>
      assignHelpers<T>(getBindings(shadowRoot), Array.from(el.querySelectorAll<T>(`[${P_TARGET}${match}"${target}"]`)))
  return (data: T) => {
    const clone = content.cloneNode(true) as DocumentFragment
    callback($(clone), data)
    return clone
  }
}
