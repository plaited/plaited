import { parameters as docsParams, decorators } from './docs/config.js'

export { renderToCanvas, render } from './render.js'

export const parameters = { renderer: 'plaited', ...docsParams }

export {decorators} 