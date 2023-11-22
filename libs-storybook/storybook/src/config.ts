import { parameters as docsParams } from './docs/config.js'

export { renderToCanvas, render } from './render.js'

export const parameters = { renderer: 'plaited', ...docsParams }
