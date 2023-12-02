import type { TemplateObject } from '@plaited/component-types'
import { kebabCase } from '@plaited/utils'
import { adoptStylesheets } from '@plaited/miles/adopt-stylesheets'
export const cssCache = new WeakMap<Document, Set<string>>()
export const createFragment = (template: TemplateObject) => {
  const { client, stylesheets } = template
  if (stylesheets.size) {
    adoptStylesheets(...stylesheets)
  }
  const tpl = document.createElement('template')
  tpl.innerHTML = client.join('')
  return tpl.content
}

// Create story id from story set tile and story export name
export const toId = (title: string, name: string) => `${kebabCase(title)}--${kebabCase(name)}`

export const isValidTitle = (title: string) => {
  const regex = /^[A-Za-z/]+$/
  const isValid = regex.test(title)
  if (!isValid) console.error(`Invalid Meta title [${title}]`)
  return isValid
}
