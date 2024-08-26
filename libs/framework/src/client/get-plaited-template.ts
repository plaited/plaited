import type { Attrs, TemplateObject, CustomElementTag } from '../jsx/types.js'
import { createTemplate } from '../jsx/create-template.js'
import { PLAITED_TEMPLATE_IDENTIFIER } from '../shared/constants.js'
import { PlaitedTemplate } from './types.js'

export const getPlaitedTemplate = <T extends Attrs>({
  tag,
  mode,
  delegatesFocus,
  shadowDom,
  publicEvents = [],
  observedAttributes = [],
}: {
  tag: CustomElementTag
  mode: 'open' | 'closed'
  delegatesFocus: boolean
  shadowDom: TemplateObject
  publicEvents?: string[]
  observedAttributes?: string[]
}): PlaitedTemplate<T> => {
  const registry = new Set<string>([...shadowDom.registry, tag])
  const ft = ({ children = [], ...attrs }: T) =>
    createTemplate(tag, {
      ...attrs,
      children: [
        createTemplate('template', {
          shadowrootmode: mode,
          shadowrootdelegatesfocus: delegatesFocus,
          children: shadowDom,
        }),
        ...(Array.isArray(children) ? children : [children]),
      ],
    })
  ft.registry = registry
  ft.tag = tag
  ft.$ = PLAITED_TEMPLATE_IDENTIFIER
  ft.publicEvents = publicEvents
  ft.observedAttributes = observedAttributes
  return ft
}
