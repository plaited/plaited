import type { DefinePlaitedTemplateArgs, PlaitedTemplate } from './types.js'
import type { Attrs } from '../jsx/types.js'
import { getPlaitedTemplate } from './get-plaited-template.js'
import { definePlaitedElement } from './define-plaited-element.js'

export const defineTemplate = <T extends Attrs = Attrs>({
  tag,
  shadowDom,
  mode = 'open',
  delegatesFocus = true,
  observedAttributes,
  publicEvents,
  ...rest
}: DefinePlaitedTemplateArgs): PlaitedTemplate<T> => {
  definePlaitedElement({
    tag,
    shadowDom,
    publicEvents,
    observedAttributes,
    ...rest,
  })
  return getPlaitedTemplate({
    tag,
    mode,
    delegatesFocus,
    shadowDom,
    publicEvents,
    observedAttributes,
  })
}
