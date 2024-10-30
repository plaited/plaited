import { type Actions } from '../behavioral/b-program.js'
import type { FunctionTemplate, CustomElementTag, Attrs } from '../jsx/jsx.types.js'
import { type DefineElementArgs, defineElement } from './define-element.js'
import { createTemplate } from '../jsx/create-template.js'
import { PLAITED_TEMPLATE_IDENTIFIER } from './client.constants.js'

interface DefineTemplateArgs<A extends Actions>
  extends Omit<DefineElementArgs<A>, 'delegatesFocus' | 'mode' | 'slotAssignment'> {
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

export const defineTemplate = <A extends Actions>({
  tag,
  shadowDom,
  mode = 'open',
  delegatesFocus = true,
  slotAssignment = 'named',
  publicEvents = [],
  observedAttributes = [],
  ...rest
}: DefineTemplateArgs<A>): PlaitedTemplate => {
  defineElement<A>({
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
  ft.publicEvents = publicEvents
  ft.observedAttributes = observedAttributes
  return ft
}
