import { instance } from '@viz-js/viz'

export const dotToSVG = async (dot: string): Promise<SVGSVGElement | undefined | string> => {
  const viz = await instance()
  try {
    return viz.renderString(dot, { format: 'svg' })
  } catch (e) {
    console.error(e)
  }
}
