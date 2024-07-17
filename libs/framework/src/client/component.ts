import type { ComponentTemplate, ComponentArgs } from './types.js'
import type { Attrs } from '../mod.js'
import { getPlaitedTemplate } from './get-plaited-template.js'
import { getPlaitedElement } from './get-plaited-element.js'
import { PLAITED_COMPONENT_TYPE } from '../shared/constants.js'


export const Component = <T extends Attrs = Attrs>({
  tag,
  template,
  mode = 'open',
  delegatesFocus = true,
  ...rest
}: ComponentArgs
): ComponentTemplate<T> => {
  getPlaitedElement({
    tag,
    mode,
    delegatesFocus,
    template,
    ...rest,
  })
  return getPlaitedTemplate<T, typeof PLAITED_COMPONENT_TYPE>({
    tag,
    mode,
    delegatesFocus,
    template,
    type: PLAITED_COMPONENT_TYPE
  })
}