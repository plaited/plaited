import type { PlaitedComponent } from './types.js'
import { getPlaitedTemplate } from './get-plaited-template.js'
import { getPlaitedElement } from './get-plaited-element.js'

export const Component: PlaitedComponent = ({
  tag,
  template,
  mode = 'open',
  delegatesFocus = true,
  ...rest
}) => {
  getPlaitedElement({
    tag,
    mode,
    delegatesFocus,
    template,
    ...rest,
  })
  return getPlaitedTemplate({
    tag,
    mode,
    delegatesFocus,
    template,
  })
}
