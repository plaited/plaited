// deno-lint-ignore-file no-extra-semi
type DomNode =
  | Element
  | Text
  | Comment

// /* (c) Andrea Giammarchi - ISC */
// // @see https://github.com/WebReflection/udomdiff
// export const diff = (a: DomNode[], b: DomNode[], before: Node) => {
//   const { parentNode } = before
//   const bLength = b.length
//   let aEnd = a.length
//   let bEnd = bLength
//   let aStart = 0
//   let bStart = 0
//   let map = null
//   while (aStart < aEnd || bStart < bEnd) {
//     // append head, tail, or nodes in between: fast path
//     if (aEnd === aStart) {
//       // we could be in a situation where the rest of nodes that
//       // need to be added are not at the end, and in such case
//       // the node to `insertBefore`, if the index is more than 0
//       // must be retrieved, otherwise it's gonna be the first item.
//       const node = bEnd < bLength
//         ? (bStart ? b[bStart - 1].nextSibling : b[bEnd - bStart])
//         : before
//       while (bStart < bEnd) {
//         ;(parentNode as Node).insertBefore(b[bStart++], node)
//       }
//     } // remove head or tail: fast path
//     else if (bEnd === bStart) {
//       while (aStart < aEnd) {
//         // remove the node only if it's unknown or not live
//         if (!map || !map.has(a[aStart])) {
//           a[aStart].remove()
//         }
//         aStart++
//       }
//     } // same node: fast path
//     else if (a[aStart] === b[bStart]) {
//       aStart++
//       bStart++
//     } // same tail: fast path
//     else if (a[aEnd - 1] === b[bEnd - 1]) {
//       aEnd--
//       bEnd--
//     } // The once here single last swap "fast path" has been removed in v1.1.0
//     // https://github.com/WebReflection/udomdiff/blob/single-final-swap/esm/index.js#L69-L85
//     // reverse swap: also fast path
//     else if (
//       a[aStart] === b[bEnd - 1] &&
//       b[bStart] === a[aEnd - 1]
//     ) {
//       // this is a "shrink" operation that could happen in these cases:
//       // [1, 2, 3, 4, 5]
//       // [1, 4, 3, 2, 5]
//       // or asymmetric too
//       // [1, 2, 3, 4, 5]
//       // [1, 2, 3, 5, 6, 4]
//       //@ts-ignore: it exist
//       const node: Node = a[--aEnd].nextSibling(parentNode as Node).insertBefore(
//         b[bStart++],
//         a[aStart++].nextSibling,
//       )
//       ;(parentNode as Node).insertBefore(b[--bEnd], node)
//       // mark the future index as identical (yeah, it's dirty, but cheap 👍)
//       // The main reason to do this, is that when a[aEnd] will be reached,
//       // the loop will likely be on the fast path, as identical to b[bEnd].
//       // In the best case scenario, the next loop will skip the tail,
//       // but in the worst one, this node will be considered as already
//       // processed, bailing out pretty quickly from the map index check
//       a[aEnd] = b[bEnd]
//     } // map based fallback, "slow" path
//     else {
//       // the map requires an O(bEnd - bStart) operation once
//       // to store all future nodes indexes for later purposes.
//       // In the worst case scenario, this is a full O(N) cost,
//       // and such scenario happens at least when all nodes are different,
//       // but also if both first and last items of the lists are different
//       if (!map) {
//         map = new Map()
//         let i = bStart
//         while (i < bEnd) {
//           map.set(b[i], i++)
//         }
//       }
//       // if it's a future node, hence it needs some handling
//       if (map.has(a[aStart])) {
//         // grab the index of such node, 'cause it might have been processed
//         const index = map.get(a[aStart])
//         // if it's not already processed, look on demand for the next LCS
//         if (bStart < index && index < bEnd) {
//           let i = aStart
//           // counts the amount of nodes that are the same in the future
//           let sequence = 1
//           while (
//             ++i < aEnd && i < bEnd && map.get(a[i]) === (index + sequence)
//           ) {
//             sequence++
//           }
//           // effort decision here: if the sequence is longer than replaces
//           // needed to reach such sequence, which would brings again this loop
//           // to the fast path, prepend the difference before a sequence,
//           // and move only the future list index forward, so that aStart
//           // and bStart will be aligned again, hence on the fast path.
//           // An example considering aStart and bStart are both 0:
//           // a: [1, 2, 3, 4]
//           // b: [7, 1, 2, 3, 6]
//           // this would place 7 before 1 and, from that time on, 1, 2, and 3
//           // will be processed at zero cost
//           if (sequence > (index - bStart)) {
//             const node = a[aStart]
//             while (bStart < index) {
//               ;(parentNode as Node).insertBefore(b[bStart++], node)
//             }
//           } // if the effort wasn't good enough, fallback to a replace,
//           // moving both source and target indexes forward, hoping that some
//           // similar node will be found later on, to go back to the fast path
//           else {
//             ;(parentNode as Node).replaceChild(
//               b[bStart++],
//               a[aStart++],
//             )
//           }
//         } // otherwise move the source forward, 'cause there's nothing to do
//         else {
//           aStart++
//         }
//       } // this node has no meaning in the future list, so it's more than safe
//       // to remove it, and check the next live node out instead, meaning
//       // that only the live list index should be forwarded
//       else {
//         a[aStart++].remove()
//       }
//     }
//   }
//   return b
// }

type DiffNode =
//   | Element
//   | Text
//   | Comment

// const getAttributes = (node: Element) => {
//   const attrs = node.attributes
//   const length = attrs.length
//   const map = new Map<string, string>()
//   for (let index = 0; index < length; index++) {
//     const attr = attrs[index]
//     map.set(attr.name, attr.value)
//   }
//   return map
// }

// const diffAttributes = (currentNode: Element, futureNode: Element) => {
//   const futureAttributes = getAttributes(futureNode)
//   const currentAttributes = getAttributes(currentNode)
//   futureAttributes.forEach((value, key) => {
//     if (!currentAttributes.has(key)) return // Doesn't have it we'll remove it later
//     if (value === currentAttributes.get(key)) { // Same values remove from current map
//       currentAttributes.delete(key)
//       return
//     }
//     currentNode.setAttribute(key, value) // Different values update attribute on current node
//   })
//   currentAttributes.forEach((_, key) => { // Remove all other attributes left in current map
//     currentNode.removeAttribute(key)
//   })
// }

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