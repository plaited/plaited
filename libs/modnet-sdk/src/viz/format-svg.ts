import { parseHTML } from 'linkedom'
import { cls } from './graph.styles.js'

export const formatSVG = (str: string) => {
  const { document } = parseHTML(`
  <!doctype html>
  <html lang="en">
    <head>
    </head>
    <body>
      ${str}
    </body>
  </html>
  `)

  const svg = document.querySelector('svg') as SVGElement
  svg.removeAttribute('width')
  svg.removeAttribute('height')
  svg.removeAttribute('xmlns')
  svg.removeAttribute('xmlns:xlink')
  svg.setAttribute('data-target', 'graph')
  svg.classList.remove('graph')
  svg.classList.add(cls.graph)
  svg.setAttribute('bp-trigger', 'click:clickGroup hover:hoverGroup')

  for (const $a of svg.querySelectorAll('a')) {
    const $g = $a.parentNode?.parentNode as SVGSVGElement
    const dataRuns = $a.getAttribute('xlink:href')
    const $docFrag = document.createDocumentFragment()
    while ($a.firstChild) {
      const $child = $a.firstChild
      $docFrag.appendChild($child)
    }

    $g.replaceChildren($docFrag)
    $g.setAttribute('data-runs', dataRuns!)
  }

  for (const $node of svg.querySelectorAll('.node')) {
    $node.classList.remove('node')
    $node.classList.add(cls.event)
    const id = $node.id
    $node.setAttribute('data-event', id)
    $node.removeAttribute('id')
  }

  for (const $edge of svg.querySelectorAll('.edge')) {
    $edge.classList.remove('edge')
    $edge.classList.add(cls.step)
    const id = $edge.id
    $edge.setAttribute('data-step', id)
    $edge.removeAttribute('id')
  }

  for (const $path of svg.querySelectorAll(`g.${cls.step} path`)) {
    const $newPath = $path.cloneNode() as HTMLElement
    $newPath.classList.add(cls['hover-path'])
    $path.classList.add(cls['step-path'])
    $path.parentNode?.appendChild($newPath)
  }

  return svg.outerHTML
}
