export const findByAttribute = (
  attributeName: string,
  attributeValue: string | RegExp,
  context?: HTMLElement | SVGElement
): Promise<HTMLElement | SVGElement | void> => {
  const searchInShadowDom = (node: Node): HTMLElement | SVGElement | void => {
    if (node.nodeType === 1) {
      const attr = (node as Element).getAttribute(attributeName)
      if (
        typeof attributeValue === 'string' &&
        attr === attributeValue
      ) {
        return node as HTMLElement | SVGElement
      }
      if (
        attributeValue instanceof RegExp &&
        attr &&
        attributeValue.test(attr)
      ) {
        return node as HTMLElement | SVGElement ?? undefined
      }
      if ((node as Element).getAttribute(attributeName) === attributeValue) {
        return node as HTMLElement | SVGElement
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
