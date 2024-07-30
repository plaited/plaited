import { handleTemplateObject, getBoundInstance, assignBinding } from './use-query.js'
import { BP_TARGET } from '../jsx/constants.js'
import type { SelectorMatch, UseClone } from './types.js'

export const useClone: UseClone = (shadowRoot) => {
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
