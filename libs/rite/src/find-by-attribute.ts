export const findByAttribute = <T extends (HTMLElement | SVGElement) = (HTMLElement | SVGElement)>(
  attributeName: string,
  attributeValue: string | RegExp,
  context?: HTMLElement | SVGElement
): Promise<T | undefined> => {
  const searchInShadowDom = (node: Node): T | undefined => {
    if (node.nodeType === 1) {
      const attr = (node as Element).getAttribute(attributeName)
      if (
        typeof attributeValue === 'string' &&
        attr === attributeValue
      ) {
        return node as T
      }
      if (
        attributeValue instanceof RegExp &&
        attr &&
        attributeValue.test(attr)
      ) {
        return node as T ?? undefined
      }
      if ((node as Element).getAttribute(attributeName) === attributeValue) {
        return node as T
      }
    }

    if (node.nodeType === 1 && (node as Element).shadowRoot) {
      for (
        const child of ((node as Element).shadowRoot as ShadowRoot).children
      ) {
        const result = searchInShadowDom(child)
        if (result) {
          return result
        }
      }
    }

    for (const child of node.childNodes) {
      const result = searchInShadowDom(child)
      if (result) {
        return result
      }
    }
  }

  return new Promise(resolve => {
    requestAnimationFrame(() => {
      const rootNode = context ?? document
      const foundNode = searchInShadowDom(rootNode)
      resolve(foundNode)
    })
  })
}
