import { udomdiff } from './udomdiff.js'

export const displayContent = (htmlContent: string) => {
  // @ts-ignore: https://developer.mozilla.org/en-US/docs/Web/API/Document/parseHTMLUnsafe_static
  const newDocument = Document.parseHTMLUnsafe(htmlContent) as Document
  const head = document.querySelector('head')
  const futureHead = newDocument.querySelector('head')
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
  const futureBody = newDocument.querySelector('body')
  if (body && futureBody) {
    body.replaceWith(futureBody)
  }
}
