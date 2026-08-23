import { SWAP_MODES, SWAP_TARGETS } from './message.constants.ts'

/**
 * Classify whether a swap mode's structural boundary is the target element
 * itself (`'self'` — content nests *into* the target) or the target's parent
 * (`'parent'` — content *replaces or flanks* the target, so the parent is the
 * boundary).
 *
 * - **Into** (`afterbegin`, `beforeend`, `innerHTML`): the target IS the
 *   structural container → `'self'`.
 * - **Replace/beside** (`beforebegin`, `afterend`, `outerHTML`): the target's
 *   parent is the container → `'parent'`.
 *
 * Shared by the Renderer (SSR) and Controller (browser) so both surfaces apply
 * the same boundary rule before reading `p-scale`.
 *
 * @param swap - A {@link SWAP_MODES} value.
 * @returns `'self'` for into modes, `'parent'` for replace/beside modes.
 * @public
 */
export const swapBoundary = (swap: keyof typeof SWAP_MODES): keyof typeof SWAP_TARGETS => {
  switch (swap) {
    case SWAP_MODES.afterbegin:
    case SWAP_MODES.beforeend:
    case SWAP_MODES.innerHTML:
      return SWAP_TARGETS.self
    default:
      return SWAP_TARGETS.parent
  }
}
