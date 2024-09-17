import type { Attrs, FunctionTemplate, CustomElementTag } from '../jsx/jsx.types.js'
import { DefineElementArgs, defineElement } from './define-element.js'
import { P_WORKER, P_SERVER } from '../jsx/jsx.constants.js'
import { createTemplate } from '../jsx/create-template.js'
import { PLAITED_TEMPLATE_IDENTIFIER } from './client.constants.js'

interface DefineTemplateArgs extends Omit<DefineElementArgs, 'delegatesFocus' | 'mode' | 'slotAssignment'> {
  delegatesFocus?: boolean
  mode?: 'open' | 'closed'
  slotAssignment?: 'named' | 'manual'
}

export type PlaitedTemplateAttrs = Attrs & {
  [P_WORKER]?: string
  [P_SERVER]?: boolean
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
}: DefineTemplateArgs): PlaitedTemplate<T> => {
  defineElement({
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
