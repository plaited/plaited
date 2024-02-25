import { Component, css } from 'plaited'
import { useEventSources, useWS } from 'plaited/utils'
import { Svg, SVG } from '@svgdotjs/svg.js'
import '@svgdotjs/svg.panzoom.js/dist/svg.panzoom.esm.js'
import { centerGroup } from './center-group.js'
import { $stylesheet, cls } from './graph.styles.js'

export const FlowDiagram = Component({
  tag: 'flow-diagram',
  template: (
    <>
      <span data-target='dynamic-styles'></span>
      <div
        data-target='canvas'
        className={cls.canvas}
        stylesheet={$stylesheet}
      ></div>
    </>
  ),
  bp({ feedback, $, root, trigger }) {
    const connect = useEventSources(root, trigger)
    const ws = useWS('ws://localhost:8080')
    connect(ws)
    let graph: Svg
    let svgFragment: DocumentFragment
    const [canvas] = $('canvas')
    const observer = new ResizeObserver((entries) => {
      for (const _ of entries) {
        // May need to throttle this
        trigger({ type: 'renderSVG', detail: svgFragment })
      }
    })
    observer.observe(canvas)
    feedback({
      renderSVG(svg: DocumentFragment) {
        svgFragment = svg
        canvas.render(svg)
        trigger({ type: 'updateGraph' })
      },
      updateGraph() {
        const [svg] = $<SVGSVGElement>('graph')
        graph = SVG(svg)
        // Center Graph
        const viewbox = centerGroup({
          graph,
          height: canvas.clientHeight,
          width: canvas.clientWidth,
          selector: `.${cls.graph}`,
          padding: 0.3,
        })
        graph.viewbox(...viewbox)
        //@ts-ignore: lib types bad
        graph.panZoom()
      },
      zoomTo(evt: MouseEvent & { target: HTMLButtonElement }) {
        const id = evt.target.id
        const viewbox = centerGroup({
          graph,
          height: canvas.clientHeight,
          width: canvas.clientWidth,
          selector: `#${id}`,
          padding: 5.5,
        })
        graph.animate().viewbox(...viewbox)
      },
      zoomIn() {
        const zoomLevel = graph.zoom()
        graph.animate().zoom(zoomLevel + 0.1) // Increase the zoom level by 0.1
      },
      zoomOut() {
        const zoomLevel = graph.zoom()
        graph.animate().zoom(zoomLevel - 0.1) // Decrease the zoom level by 0.1
      },
      zoomReset() {
        const viewbox = centerGroup({
          graph,
          height: canvas.clientHeight,
          width: canvas.clientWidth,
          selector: `.${cls.graph}`,
          padding: 0.3,
        })
        graph.animate().viewbox(...viewbox)
      },
    })
  },
})
