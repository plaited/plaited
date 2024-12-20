import type { FunctionTemplate, CustomElementTag, Attrs } from '../jsx/jsx.types.js'
import { type GetElementArgs, getElement, type PlaitedHandlers } from './get-element.js'
import { createTemplate } from '../jsx/create-template.js'
import { PLAITED_TEMPLATE_IDENTIFIER, ELEMENT_CALLBACKS } from './plaited.constants.js'

interface DefineTemplateArgs<A extends PlaitedHandlers>
  extends Omit<GetElementArgs<A>, 'delegatesFocus' | 'mode' | 'slotAssignment'> {
  delegatesFocus?: boolean
  mode?: 'open' | 'closed'
  slotAssignment?: 'named' | 'manual'
}

export type PlaitedTemplate = FunctionTemplate & {
  registry: Set<string>
  tag: CustomElementTag
  observedAttributes: string[]
  publicEvents: string[]
  $: typeof PLAITED_TEMPLATE_IDENTIFIER
}

export const defineTemplate = <A extends PlaitedHandlers>({
  tag,
  shadowDom,
  mode = 'open',
  delegatesFocus = true,
  slotAssignment = 'named',
  publicEvents,
  observedAttributes = [],
  streamAssociated,
  ...rest
}: DefineTemplateArgs<A>): PlaitedTemplate => {
  const events: string[] = [
    ...(publicEvents ?? []),
    ...(streamAssociated ?
      [ELEMENT_CALLBACKS.onAppend, ELEMENT_CALLBACKS.onPrepend, ELEMENT_CALLBACKS.onReplaceChildren]
    : []),
  ]
  getElement<A>({
    tag,
    shadowDom,
    publicEvents: events,
    slotAssignment,
    delegatesFocus,
    mode,
    observedAttributes,
    streamAssociated,
    ...rest,
  })
  const registry = new Set<string>([...shadowDom.registry, tag])
  const ft = ({ children = [], ...attrs }: Attrs) =>
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
  ft.publicEvents = events
  ft.observedAttributes = observedAttributes
  return ft
}
