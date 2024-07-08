import type { PlaitedTemplate, TemplateObject } from '../types.js'
import { createTemplate } from '../jsx/create-template.js'
import { PLAITED_COMPONENT_IDENTIFIER } from '../shared/constants.js'

export const getPlaitedTemplate = ({
  tag,
  mode,
  delegatesFocus,
  template,
}: {
  tag: `${string}-${string}`
  mode: 'open' | 'closed'
  delegatesFocus: boolean
  template: TemplateObject
}) => {
  const ft: PlaitedTemplate = ({ children = [], ...attrs }) =>
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
  ft.tag = tag
  ft.$ = PLAITED_COMPONENT_IDENTIFIER
  return ft
}
