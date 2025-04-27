import type { BoundElement, SelectorMatch } from './plaited.types'
import { assignHelpers, getBindings } from './assign-helpers'
import { P_TARGET } from '../jsx/jsx.constants.js'

export const useTemplate = <T>(
  el: BoundElement<HTMLTemplateElement>,
  callback: (
    $: <E extends Element = Element>(
      target: string,
      /** This options enables querySelectorAll and modified the attribute selector for p-target{@default {all: false, mod: "=" } } {@link https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors#syntax}*/
      match?: SelectorMatch,
    ) => BoundElement<E>[],
    data: T,
  ) => void,
) => {
  const content = el.content
  const bindings = getBindings(el.getRootNode() as ShadowRoot)
  return (data: T) => {
    const clone = content.cloneNode(true) as DocumentFragment
    callback(
      <E extends Element = Element>(target: string, match: SelectorMatch = '=') =>
        assignHelpers<E>(bindings, clone.querySelectorAll<E>(`[${P_TARGET}${match}"${target}"]`)),
      data,
    )
    return clone
  }
}
