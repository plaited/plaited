import type { ModuleTemplate, ModuleArgs } from './types.js'
import type { Attrs } from '../mod.js'
import { getPlaitedTemplate } from './get-plaited-template.js'
import { getPlaitedElement } from './get-plaited-element.js'
import { useAjax } from './use-ajax.js'
import { publish, subscribe } from './web-socket.js'
import { PLAITED_MODULE_TYPE } from '../shared/constants.js'

export const Module = <T extends Attrs = Attrs>({
  tag,
  template,
  mode = 'open',
  delegatesFocus = true,
  ...rest
}: ModuleArgs
):ModuleTemplate<T> => {
  getPlaitedElement({
    tag,
    mode,
    delegatesFocus,
    template,
    useAjax,
    publish,
    subscribe,
    ...rest,
  })
  return getPlaitedTemplate<T, typeof PLAITED_MODULE_TYPE>({
    tag,
    mode,
    delegatesFocus,
    template,
    type: PLAITED_MODULE_TYPE
  })
}