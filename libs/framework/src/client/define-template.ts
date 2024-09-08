import type { Attrs, FunctionTemplate, CustomElementTag } from '../jsx/types.js'
import { PLAITED_TEMPLATE_IDENTIFIER } from '../shared/constants.js'
import { DefinePlaitedElementArgs, definePlaitedElement } from './define-plaited-element.js'
import { P_HANDLER } from './constants.js'
import { createTemplate } from '../jsx/create-template.js'

export interface DefinePlaitedTemplateArgs extends Omit<DefinePlaitedElementArgs, 'delegatesFocus' | 'mode' | 'slotAssignment'> {
  delegatesFocus?: boolean
  mode?: 'open' | 'closed'
  slotAssignment?: 'named' | 'manual'
}

export type PlaitedTemplateAttrs = Attrs & {
  [P_HANDLER]?: string
}

export type PlaitedTemplate<T extends PlaitedTemplateAttrs = PlaitedTemplateAttrs> = FunctionTemplate<T> & {
  registry: Set<string>
  tag: CustomElementTag
  observedAttributes: string[]
  publicEvents: string[]
  $: typeof PLAITED_TEMPLATE_IDENTIFIER
}

export const defineTemplate = <T extends Attrs = Attrs>({
  tag,
  shadowDom,
  mode = 'open',
  delegatesFocus = true,
  slotAssignment = 'named',
  publicEvents = [],
  observedAttributes = [],
  ...rest
}: DefinePlaitedTemplateArgs): PlaitedTemplate<T> => {
  definePlaitedElement({
    tag,
    shadowDom,
    publicEvents,
    slotAssignment,
    delegatesFocus,
    mode,
    observedAttributes,
    ...rest,
  })
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
