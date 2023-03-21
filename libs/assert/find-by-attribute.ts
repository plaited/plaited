export const findByAttribute = (
  attributeName: string,
  attributeValue: string | RegExp,
  context?: HTMLElement | SVGElement,
): Promise<HTMLElement | SVGElement | void> => {
  const searchInShadowDom = (node: Node): HTMLElement | SVGElement | void => {
    if (
      (
        node instanceof HTMLElement ||
        node instanceof SVGElement
      )
    ) {
      const attr = node.getAttribute(attributeName)
      if (
        typeof attributeValue === 'string' &&
        attr === attributeValue
      ) {
        return node
      }
      if (
        attributeValue instanceof RegExp &&
        attr &&
        attributeValue.test(attr)
      ) {
        return node ?? undefined
      }
      if (node.getAttribute(attributeName) === attributeValue) {
        return node
      }
    }

    if (node instanceof HTMLElement && node.shadowRoot) {
      for (const child of node.shadowRoot.children) {
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

  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      const rootNode = context ?? document
      const foundNode = searchInShadowDom(rootNode)
      resolve(foundNode)
    })
  })
}
