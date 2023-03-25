import { html } from './html.ts'
import { wire } from './wire.ts'
import { template } from './template.ts'
import { IsleTemplateProps } from './types.ts'

export const IsleTemplate = template<IsleTemplateProps>(({
  tag,
  shadow,
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
      ${shadow}
    </template>
    ${slots}
  </${tag}>
  `
})
