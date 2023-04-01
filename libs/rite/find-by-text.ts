export const findByText = (
  searchText: string | RegExp,
  context?: HTMLElement,
): Promise<HTMLElement | void> => {
  const searchInShadowDom = (node: Node): HTMLElement | void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const content = node.textContent?.trim()
      if (typeof searchText === 'string' && content === searchText) {
        return node.parentElement ?? undefined
      } else if (
        searchText instanceof RegExp && content && searchText.test(content)
      ) {
        return node.parentElement ?? undefined
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
      const rootNode = context ?? document.body
      const foundNode = searchInShadowDom(rootNode)
      resolve(foundNode)
    })
  })
}
