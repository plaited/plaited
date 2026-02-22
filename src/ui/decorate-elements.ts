import { createTemplate } from './create-template.ts'
import type { Attrs, CustomElementTag, FunctionTemplate, TemplateObject } from './create-template.types.ts'
import type { DesignTokenReference, HostStylesObject } from './css.types.ts'
import { joinStyles } from './join-styles.ts'

export const DECORATOR_TEMPLATE_IDENTIFIER = '🎨' as const

export type DecoratorTemplate = FunctionTemplate & {
  $: typeof DECORATOR_TEMPLATE_IDENTIFIER
}

export const decorateElements = ({
  tag,
  shadowDom,
  mode = 'open',
  delegatesFocus = true,
  cloneable = true,
  hostStyles,
}: {
  tag: CustomElementTag
  shadowDom: TemplateObject
  delegatesFocus?: boolean
  cloneable?: boolean
  mode?: 'open' | 'closed'
  hostStyles?: HostStylesObject | DesignTokenReference
}): DecoratorTemplate => {
  const { stylesheets } = joinStyles(hostStyles, { stylesheets: shadowDom.stylesheets ?? [] })
  if (stylesheets.length) {
    const styles = `<style>${[...new Set(stylesheets)].join('')}</style>`
      .replaceAll(/:root\{/g, ':host{')
      .replaceAll(/:root\(([^)]+)\)/g, ':host')
    shadowDom.html.unshift(styles)
  }
  const ft: DecoratorTemplate = ({ children = [], ...attrs }: Attrs) =>
    createTemplate(tag, {
      ...attrs,
      children: [
        createTemplate('template', {
          shadowrootmode: mode,
          shadowrootdelegatesfocus: delegatesFocus,
          shadowrootclonable: cloneable,
          children: {
            ...shadowDom,
            stylesheets: [],
          },
        }),
        ...(Array.isArray(children) ? children : [children]),
      ],
    })
  ft.$ = DECORATOR_TEMPLATE_IDENTIFIER
  return ft
}
