import type { Attrs, TemplateObject } from '../jsx/types.js'
import { createTemplate } from '../jsx/create-template.js'
import { PLAITED_COMPONENT_IDENTIFIER } from '../shared/constants.js'
import { PlaitedTemplate } from './types.js'

export const getPlaitedTemplate = <T extends Attrs>({
  tag,
  mode,
  delegatesFocus,
  shadowRoot,
  publicEvents = [],
  observedAttributes = [],
}: {
  tag: `${string}-${string}`
  mode: 'open' | 'closed'
  delegatesFocus: boolean
  shadowRoot: TemplateObject
  publicEvents?: string[]
  observedAttributes?: string[]
}): PlaitedTemplate<T> => {
  const registry = new Set<string>([...shadowRoot.registry, tag])
  const ft = ({ children = [], ...attrs }: T) =>
    createTemplate(tag, {
      ...attrs,
      children: [
        createTemplate('template', {
          shadowrootmode: mode,
          shadowrootdelegatesfocus: delegatesFocus,
          children: shadowRoot,
        }),
        ...(Array.isArray(children) ? children : [children]),
      ],
    })
  ft.registry = registry
  ft.tag = tag
  ft.$ = PLAITED_COMPONENT_IDENTIFIER
  ft.publicEvents = publicEvents
  ft.observedAttributes = observedAttributes
  return ft
}
