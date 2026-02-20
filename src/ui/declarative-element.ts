import { createTemplate } from './create-template.ts'
import type { Attrs, CustomElementTag, FunctionTemplate, TemplateObject } from './create-template.types.ts'
import type { DesignTokenReference, HostStylesObject } from './css.types.ts'

export type DeclarativeElementTemplate = FunctionTemplate & {
  registry: Set<string>
  tag: CustomElementTag
  observedAttributes: string[]
  publicEvents: string[]
  hostStyles: HostStylesObject | DesignTokenReference
  $: typeof DECLARATIVE_ELEMENT_TEMPLATE_IDENTIFIER
}

export const DECLARATIVE_ELEMENT_TEMPLATE_IDENTIFIER = '🐻' as const

export const declarativeElement = ({
  tag,
  shadowDom,
  mode = 'open',
  delegatesFocus = true,
  publicEvents = [],
  hostStyles,
  observedAttributes = [],
}: {
  tag: CustomElementTag
  shadowDom: TemplateObject
  delegatesFocus?: boolean
  mode?: 'open' | 'closed'
  slotAssignment?: 'named' | 'manual'
  observedAttributes?: string[]
  publicEvents?: string[]
  hostStyles?: HostStylesObject
  formAssociated?: true
}): DeclarativeElementTemplate => {
  const registry = new Set<string>([...shadowDom.registry, tag])
  if (shadowDom.stylesheets.length) {
    const styles = `<style>${[...new Set(shadowDom.stylesheets)].join('')}</style>`
      .replaceAll(/:root\{/g, ':host{')
      .replaceAll(/:root\(([^)]+)\)/g, ':host')
    shadowDom.html.unshift(styles)
  }
  const ft = ({ children = [], ...attrs }: Attrs) =>
    createTemplate(tag, {
      ...attrs,
      children: [
        createTemplate('template', {
          shadowrootmode: mode,
          shadowrootdelegatesfocus: delegatesFocus,
          children: {
            ...shadowDom,
            stylesheets: [],
          },
        }),
        ...(Array.isArray(children) ? children : [children]),
      ],
    })
  ft.registry = registry
  ft.tag = tag
  ft.$ = DECLARATIVE_ELEMENT_TEMPLATE_IDENTIFIER
  ft.publicEvents = publicEvents
  ft.observedAttributes = observedAttributes
  ft.hostStyles = hostStyles ?? { stylesheets: [] }
  return ft
}
