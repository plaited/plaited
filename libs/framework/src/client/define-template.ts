import type { DefinePlaitedTemplateArgs, PlaitedTemplate } from './types.js'
import type { Attrs } from '../jsx/types.js'
import { getPlaitedTemplate } from './get-plaited-template.js'
import { definePlaitedElement } from './define-plaited-element.js'
import { createTemplate } from '../jsx/create-template.js'

export const defineTemplate = <T extends Attrs = Attrs>({
  tag,
  shadowDom = createTemplate('slot', {}),
  mode = 'open',
  delegatesFocus = true,
  observedAttributes,
  publicEvents,
  ...rest
}: DefinePlaitedTemplateArgs): PlaitedTemplate<T> => {
  definePlaitedElement({
    tag,
    mode,
    delegatesFocus,
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
