import type { TemplateObject } from '@plaited/component-types'
import { kebabCase, canUseDOM } from '@plaited/utils'

let parser: {
  parseFromString(
    string: string,
    type: DOMParserSupportedType,
    options: {
      includeShadowRoots: boolean
    },
  ): Document
}

if (canUseDOM()) {
  parser = new DOMParser()
}

export const createTemplateElement = (content: string) => {
  const fragment = parser.parseFromString(`<template>${content}</template>`, 'text/html', {
    includeShadowRoots: true,
  })
  return fragment.head.firstChild as HTMLTemplateElement
}

export const createFragment = (template: TemplateObject) => {
  const { client, stylesheets } = template
  const style = stylesheets.size ? `<style>${[...stylesheets].join('')}</style>` : ''
  return createTemplateElement(client + style).content
}

// Create story id from story set tile and story export name
export const toId = (title: string, name: string) => `${kebabCase(title)}--${kebabCase(name)}`

export const isValidTitle = (title: string) => {
  const regex = /^[A-Za-z/]+$/
  const isValid = regex.test(title)
  if (!isValid) console.error(`Invalid Meta title [${title}]`)
  return isValid
}
