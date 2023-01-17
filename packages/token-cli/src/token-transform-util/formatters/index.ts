/**
 * This formatter object will return formatters that will create content for an
 * optimized css stylesheet of css custom properties to be applied to :root
 */
export { cssTokens } from './css-tokens/index.js'
/**
 * This formatter object will return formatters that will create content for
 * a treeshakeable mapping to token values to be used directly in ts/js files
 * most likely for computation
 */
export { jsRaw } from './js-raw/index.js'
/**
 * This formatter object will return formatters that will create content for
 * a treeshakeable mapping to css custom properties references to be used
 * inline styles in ts/js component files
 */
export { jsTokens } from './js-tokens/index.js'


/**
 * Utility helpers for resolving aliased values in tokens object
 */

export * from './resolve'
