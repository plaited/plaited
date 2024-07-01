import { handleTemplateObject, getSugarInstance, assignSugar } from './use-query.js'
import { bpTarget } from '../jsx/constants.js'
import type { SelectorMatch, UseClone } from '../types.js'

export const useClone: UseClone = (shadowRoot) => {
  const sugar = getSugarInstance(shadowRoot)
  const Query =
    (frag: DocumentFragment) =>
    <T extends Element = Element>(target: string, match: SelectorMatch = '=') =>
      assignSugar<T>(sugar, Array.from(frag.querySelectorAll<Element>(`[${bpTarget}${match}"${target}"]`)))
  return (template, callback) => {
    return (data) => {
      const content = handleTemplateObject(shadowRoot, template)
      callback(Query(content), data)
      return content
    }
  }
}
