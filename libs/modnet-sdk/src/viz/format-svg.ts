import { cls } from './graph.styles.js'

const nodeTriggers = 'href="click:selectNode hover:highlightNode"'

export const formatSVG = (svg: SVGSVGElement): SVGSVGElement => {
  svg.removeAttribute('width')
  svg.removeAttribute('height')
  svg.setAttribute('data-target', 'graph')
  svg.classList.remove('graph')
  svg.classList.add(cls.graph)
  for (const $a of svg.querySelectorAll('a')) {
    const $g = $a.parentNode! as SVGSVGElement

    const $docFrag = document.createDocumentFragment()
    while ($a.firstChild) {
      const $child = $a.firstChild
      $docFrag.appendChild($child)
    }

    $g.replaceChild($docFrag, $a)

    $g.id = $g.id.replace(/^a_/, '')
  }
  for (const $el of svg.querySelectorAll('title')) {
    $el.remove()
  }

  for (const $node of svg.querySelectorAll('.node')) {
    $node.classList.remove('node')
    $node.classList.add(cls.node)
  }

  const edgesSources = new Set<string>()
  for (const $edge of svg.querySelectorAll('.edge')) {
    $edge.classList.remove('edge')
    $edge.classList.add(cls.edge)
    const [from, to] = $edge.id.split('=>')
    $edge.removeAttribute('id')
    $edge.setAttribute('data-from', from)
    $edge.setAttribute('data-to', to)
    edgesSources.add(from)
  }

  for (const $path of svg.querySelectorAll(`g.${cls.edge} path`)) {
    const $newPath = $path.cloneNode() as HTMLElement
    $newPath.classList.add(cls.hoverPath)
    $path.classList.add(cls.edgePath)
    $path.parentNode?.appendChild($newPath)
  }
  return svg
}
