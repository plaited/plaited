import type { DefinePlaitedElementArgs, PlaitedTemplate } from './types.js'
import type { Attrs } from '../jsx/types.js'
import { getPlaitedTemplate } from './get-plaited-template.js'
import { definePlaitedElement } from './define-plaited-element.js'

export const defineTemplate = <T extends Attrs = Attrs>({
  tag,
  shadowRoot,
  mode = 'open',
  delegatesFocus = true,
  observedAttributes,
  publicEvents,
  ...rest
}: DefinePlaitedElementArgs): PlaitedTemplate<T> => {
  definePlaitedElement({
    tag,
    mode,
    delegatesFocus,
    shadowRoot,
    ...rest,
  })
  return getPlaitedTemplate({
    tag,
    mode,
    delegatesFocus,
    shadowRoot,
    publicEvents,
    observedAttributes,
  })
}
