import { html } from './html.ts'
import { Wire, wire } from './wire.ts'
import { template } from './template.ts'

interface IslandTemplateProps extends Wire {
  /** the element tag you want to use */
  tag: `${string}-${string}`
  /** the shadowDom template for the Island */
  template: string
  /**
   * Island element's shadowDom mode
   * @defaultValue 'open' */
  mode?: 'open' | 'closed'
}

export const IslandTemplate = template<IslandTemplateProps>(({
  tag,
  template,
  mode = 'open',
  ...rest
}) =>
  html`
  <${tag} ${wire({ ...rest })}>
    <template shadowroot="${mode}">
      ${template}
    </template>
  </${tag}>
  `
)
