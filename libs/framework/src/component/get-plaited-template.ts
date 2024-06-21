import { createTemplate } from '../jsx/create-template.js'
import type { GetPlaitedElement, PlaitedTemplate, TemplateObject } from '../types.js'
import { defineRegistry } from './define-registry.js'
import { PLAITED_COMPONENT_IDENTIFIER } from '../shared/constants.js'

export const getPlaitedTemplate = ({
  getPlaitedElement,
  mode,
  delegatesFocus,
  template,
}: {
  getPlaitedElement: GetPlaitedElement
  mode: 'open' | 'closed'
  delegatesFocus: boolean
  template: TemplateObject
}) => {
  const registry = new Set<GetPlaitedElement>([...template.registry, getPlaitedElement])
  const ft: PlaitedTemplate = ({ children = [], ...attrs }) =>
    createTemplate(getPlaitedElement.tag, {
      ...attrs,
      children: [
        createTemplate('template', {
          shadowrootmode: mode,
          shadowrootdelegatesfocus: delegatesFocus,
          children: {
            ...template,
            registry,
          },
        }),
        ...(Array.isArray(children) ? children : [children]),
      ],
    })
  ft.define = (silent = true) => defineRegistry(new Set<GetPlaitedElement>(registry), silent)
  ft.tag = getPlaitedElement.tag
  ft.$ = PLAITED_COMPONENT_IDENTIFIER
  return ft
}
