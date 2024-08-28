import type { DefinePlaitedTemplateArgs, PlaitedTemplate } from './types.js'
import type { Attrs } from '../jsx/types.js'
import { getPlaitedTemplate } from './get-plaited-template.js'
import { definePlaitedElement } from './define-plaited-element.js'

export const defineTemplate = <T extends Attrs = Attrs>({
  tag,
  shadowDom,
  mode = 'open',
  delegatesFocus = true,
  slotAssignment = 'named',
  observedAttributes,
  publicEvents,
  ...rest
}: DefinePlaitedTemplateArgs): PlaitedTemplate<T> => {
  definePlaitedElement({
    tag,
    shadowDom,
    publicEvents,
    slotAssignment,
    delegatesFocus,
    mode,
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
