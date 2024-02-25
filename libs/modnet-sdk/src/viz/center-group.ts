import { Element, Svg } from '@svgdotjs/svg.js'
import '@svgdotjs/svg.panzoom.js/dist/svg.panzoom.esm.js'

export const centerGroup = ({
  graph,
  selector,
  padding,
  width,
  height,
}: {
  graph: Svg
  selector: `.${string}` | `#${string}`
  padding: number
  width: number
  height: number
}): [number, number, number, number] => {
  // Find the modules group with the class the id
  const group = graph.findOne(selector) as Element

  // Get the group's bounding box in the global SVG coordinate system
  const BBox = group.rbox(graph)

  // Calculate the scale factor to fit the group within the desired width and height
  const scaleX = width / BBox.width
  const scaleY = height / BBox.height
  const scale = Math.min(scaleX, scaleY)

  // Calculate dynamic padding factor based on overflow
  const overflowX = (BBox.width * scale) / width
  const overflowY = (BBox.height * scale) / height
  const paddingFactor = Math.max(overflowX, overflowY) + padding // Base padding of 10% + dynamic adjustment

  const newWidth = (width / scale) * paddingFactor
  const newHeight = (height / scale) * paddingFactor

  // Calculate the new viewbox coordinates to center the .graph group with padding
  const newX = BBox.cx - newWidth / 2
  const newY = BBox.cy - newHeight / 2

  // new viewbox
  return [newX, newY, newWidth, newHeight]
}
