import { html } from './html.ts'
import { Wire, wire } from './wire.ts'
import { template } from './template.ts'

interface IslandTemplateProps extends Wire {
  tag: string
  template: string
  /** @defaultValue 'open' */
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
