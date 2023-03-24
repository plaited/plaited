import { html } from './html.ts'
import { Wire, wire } from './wire.ts'
import { template } from './template.ts'
import { CustomElementTag } from './types.ts'

interface IslandTemplateProps extends Wire {
  /** the element tag you want to use */
  tag: CustomElementTag
  /** the shadowDom template for the Island */
  template: string
  /**
   * Island element's shadowDom mode
   * @defaultValue 'open' */
  mode?: 'open' | 'closed'
  /**
   * Sets whether Island element's shadowRoot delegates focus
   * @defaultValue 'true' */
  delegatesFocus?: boolean
  /** Slotted content for the island */
  slots?: string[] | string
  /** stylesheets */
  styles?: string | Set<string>
}

export const IslandTemplate = template<IslandTemplateProps>(({
  tag,
  template,
  mode = 'open',
  delegatesFocus = true,
  slots,
  styles,
  ...rest
}) => {
  const stylesheet = styles &&
    html`<style>${typeof styles === 'string' ? styles : [...styles]}</style>`
  return html`
  <${tag} ${wire({ ...rest })}>
    <template
      shadowrootmode="${mode}"
      ${delegatesFocus && 'shadowrootdelegatesfocus'}
    >
      ${stylesheet}
      ${template}
    </template>
    ${slots}
  </${tag}>
  `
})
