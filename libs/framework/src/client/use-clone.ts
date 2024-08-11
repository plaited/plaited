import type { SelectorMatch, Clone } from './types.js'
import { handleTemplateObject, getBoundInstance, assignBinding } from './use-query.js'
import { BP_TARGET } from '../jsx/constants.js'

/** Clone feature for handling list situations where structure is consistent but the data rendered is what is different. This is a performance feature */
export const useClone = (shadowRoot: ShadowRoot): Clone => {
  const instance = getBoundInstance(shadowRoot)
  const Query =
    (frag: DocumentFragment) =>
    <T extends Element = Element>(target: string, match: SelectorMatch = '=') =>
      assignBinding<T>(instance, Array.from(frag.querySelectorAll<Element>(`[${BP_TARGET}${match}"${target}"]`)))
  return (template, callback) => {
    return (data) => {
      const content = handleTemplateObject(shadowRoot, template)
      callback(Query(content), data)
      return content
    }
  }
}
