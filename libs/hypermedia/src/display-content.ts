import { udomdiff } from './udomdiff.js'

export const displayContent = (htmlContent: Document | DocumentFragment) => {
  const head = document.querySelector('head')
  const futureHead = htmlContent.querySelector('head')
  if (head && futureHead) {
    const futureNodes = udomdiff(
      head,
      Array.from(head?.childNodes || []),
      Array.from(futureHead?.childNodes || []),
      (o: Node) => o,
    )
    head.replaceChildren(...futureNodes)
  }
  const body = document.querySelector('body')
  const futureBody = htmlContent.querySelector('body')
  if (body && futureBody) {
    body.replaceWith(futureBody)
  }
}
