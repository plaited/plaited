type DiffNode =
  | Element
  | Text
  | Comment

const getAttributes = (node: Element) => {
  const attrs = node.attributes
  const length = attrs.length
  const map = new Map<string, string>()
  for (let index = 0; index < length; index++) {
    const attr = attrs[index]
    map.set(attr.name, attr.value)
  }
  return map
}

const diffAttributes = (currentNode: Element, futureNode: Element) => {
  const futureAttributes = getAttributes(futureNode)
  const currentAttributes = getAttributes(currentNode)
  futureAttributes.forEach((value, key) => {
    if (!currentAttributes.has(key)) return // Doesn't have it we'll remove it later
    if (value === currentAttributes.get(key)) { // Same values remove from current map
      currentAttributes.delete(key)
      return
    }
    currentNode.setAttribute(key, value) // Different values update attribute on current node
  })
  currentAttributes.forEach((_, key) => { // Remove all other attributes left in current map
    currentNode.removeAttribute(key)
  })
}

const diff = (parent: Element | DocumentFragment, future: DiffNode[]) => {
  // P1 parent node list is longer
  const current: DiffNode[] = Array.prototype.slice.call(parent.childNodes)
  let count = current.length - future.length
  if (count > 0) {
    for (; count > 0; count--) {
      current[current.length - count].remove()
    }
  }
  const length = future.length
  for (let index = 0; index < length; index++) {
    const futureNode = future[index]
    const currentNode = current[index]
    // P2 If current node doesn't exist, create it
    if (!currentNode) {
      parent.appendChild(futureNode.cloneNode(true))
      continue
    }

    const futureNodeType = futureNode.nodeType

    // P3 If currentNode and futureNode are not the same type, replace currentNode with futureNode
    if (futureNodeType !== currentNode.nodeType) {
      parent.replaceChild(
        futureNode.cloneNode(true),
        currentNode,
      )
      continue
    }

    // P4 if both nodes are of  comment or text
    if (futureNodeType === 3 || futureNodeType === 8) {
      parent.replaceChild(
        futureNode.cloneNode(true),
        currentNode,
      )
      continue
    }

    // P5 diff attributes lazily full style and class replacement
    diffAttributes(currentNode as Element, futureNode as Element)

    const futureLength = futureNode.childNodes.length
    const currentLength = currentNode.childNodes.length

    //P6 If target element should be empty, wipe it
    if (currentLength > 0 && futureLength < 1) {
      // deno-lint-ignore no-extra-semi
      ;(currentNode as Element).replaceChildren()
      continue
    }

    const futureList: DiffNode[] = Array.prototype.slice.call(
      futureNode.childNodes,
    )

    // P7 If element is empty and shouldn't be, build it up
    // This uses a document fragment to minimize reflows
    if (currentLength < 1 && futureLength > 0) {
      const fragment = document.createDocumentFragment()
      diff(fragment, futureList)
      currentNode.appendChild(fragment)
      continue
    }

    // If there are existing child elements that need to be modified, diff them
    if (futureLength > 0) {
      diff(currentNode as Element, futureList)
    }
  }
}

export const render = (
  parent: Element,
  template: string,
  position?: 'afterbegin' | 'beforeend',
) => {
  console.log({ template })
  const fragment = new DOMParser().parseFromString(
    `<div>${template}</div>`,
    'text/html',
    //@ts-ignore: new spec feature
    {
      includeShadowRoots: true,
    },
  )
  return position === 'afterbegin'
    ? parent.prepend(...(fragment.body.firstChild as HTMLDivElement).childNodes)
    : position === 'beforeend'
    ? parent.append(...(fragment.body.firstChild as HTMLDivElement).childNodes)
    : diff(
      parent,
      Array.prototype.slice.call(
        (fragment.body.firstChild as HTMLDivElement).childNodes,
      ),
    )
}
