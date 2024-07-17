import type { TemplateObject, Attrs} from '../jsx/types.js'
import { createTemplate } from '../jsx/create-template.js'

export const getPlaitedTemplate = <T extends Attrs, U>({
  tag,
  mode,
  delegatesFocus,
  template,
  type,
}: {
  tag: `${string}-${string}`
  mode: 'open' | 'closed'
  delegatesFocus: boolean
  template: TemplateObject
  type: U
}) => {
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
  ft.type = type
  return ft
}
