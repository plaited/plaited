import { defineTemplate } from '../main/define-template.js'
import { css } from './css.js'
import { h } from '../jsx/create-template.js'
import type { CustomElementTag } from '../jsx/jsx.types.js'

/**
 * Creates a custom element template for injecting design tokens into the DOM.
 * Generates a web component that encapsulates design token styles in shadow DOM.
 *
 * Features:
 * - Shadow DOM encapsulation
 * - Display: contents for transparent rendering
 * - Custom element tag name support
 * - Style injection via stylesheet
 *
 * @param stylesheet CSS string containing design token definitions
 * @param tag Custom element tag name (must contain hyphen)
 * @returns Defined custom element template
 *
 * @example
 * // Basic usage
 * const TokensElement = getDesignTokensElement(tokenStyles);
 *
 * // Custom tag name
 * const BrandTokens = getDesignTokensElement(
 *   brandStyles,
 *   'brand-tokens'
 * );
 *
 * @remarks
 * - Creates a style container using shadow DOM
 * - Uses 'display: contents' to prevent layout impact
 * - Automatically handles shadow DOM style scoping
 * - Defaults to 'design-tokens' tag if none provided
 * - Follows web components specification
 */
export const getDesignTokensElement = (stylesheet: string, tag: CustomElementTag = 'design-tokens') => {
  return defineTemplate({
    tag,
    shadowDom: h('slot', {
      ...css.assign(
        css.host({
          display: 'contents',
        }),
        { stylesheet },
      ),
    }),
  })
}
