import { html } from './html.ts'
import { dataTarget, dataTrigger } from './constants.ts'
import { TemplateProps } from './template.ts'
/** @description wires attributes to templates with sensible escaping */
export interface Wire extends TemplateProps {
  target?: string
  triggers?: Record<string, string>
}
export const wire = (obj: Wire) => {
  const attributes = []
  for (const prop in obj) {
    const value = obj[prop]
    if (value === undefined || value === null) continue
    if (prop === 'target') {
      attributes.push(`${dataTarget}="${value}"`)
      continue
    }
    if (prop === 'triggers') {
      attributes.push(
        `${dataTrigger}="${
          Object.entries(value as unknown as Record<string, string>)
            .map<string>(([ev, req]) => `${ev}->${req}`)
            .join(' ')
        }"`,
      )
      continue
    }
    if (prop === 'className') {
      attributes.push(`class="${value}"`)
      continue
    }
    if (prop === 'htmlFor') {
      attributes.push(`for="${value}"`)
      continue
    }
    if (!prop.startsWith('aria') && !value) continue
    if (!prop.startsWith('aria') && typeof value === 'boolean') {
      attributes.push(html`$${prop}`)
      continue
    }
    attributes.push(html`${prop}="$${value?.toString()}"`)
  }
  return attributes.join(' ')
}
