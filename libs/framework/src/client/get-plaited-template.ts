import type { Attrs, TemplateObject} from '../jsx/types.js'
import { createTemplate } from '../jsx/create-template.js'
import { PLAITED_COMPONENT_IDENTIFIER } from '../shared/constants.js'
import { PlaitedTemplate } from './types.js'

export const getPlaitedTemplate = <T extends Attrs>({
  tag,
  mode,
  delegatesFocus,
  template,
}: {
  tag: `${string}-${string}`
  mode: 'open' | 'closed'
  delegatesFocus: boolean
  template: TemplateObject
}): PlaitedTemplate<T> => {
  const registry = new Set<string>([...template.registry, tag])
  const ft = ({ children = [], ...attrs }: T) =>
    createTemplate(tag, {
      ...attrs,
      children: [
        createTemplate('template', {
          shadowrootmode: mode,
          shadowrootdelegatesfocus: delegatesFocus,
          children: template,
        }),
        ...(Array.isArray(children) ? children : [children]),
      ],
    })
  ft.registry = registry
  ft.tag = tag
  ft.$ = PLAITED_COMPONENT_IDENTIFIER
  return ft
}
