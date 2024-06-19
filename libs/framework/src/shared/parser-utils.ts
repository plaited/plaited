let parser: {
  parseFromString(
    string: string,
    type: DOMParserSupportedType,
    options: {
      includeShadowRoots: boolean
    },
  ): Document
}

export const createDoc = (page: string) => {
  if (typeof window !== 'undefined' && window.DOMParser) {
    parser = new DOMParser()
  }
  return parser.parseFromString(page, 'text/html', { includeShadowRoots: true })
}

export const createTemplateElement = (content: string) => {
  if (typeof window !== 'undefined' && window.DOMParser) {
    parser = new DOMParser()
  }
  const fragment = parser.parseFromString(`<template>${content}</template>`, 'text/html', {
    includeShadowRoots: true,
  })
  return fragment.head.firstChild as HTMLTemplateElement
}
