import { bElement, createHostStyles, type FT } from '../main.ts'
import { MASK_EVENTS } from './testing.constants.ts'
import type { MaskClickDetail } from './testing.types.ts'
import { getShadowPath } from './testing.utils.ts'

/**
 * Host styles for grid positioning and z-index layering.
 */
const _maskHostStyles = createHostStyles({
  display: 'none', // Initially hidden
  width: '100%',
  height: '100%',
  backgroundColor: 'rgba(0, 0, 0, 0.05)',
  cursor: 'crosshair',
})

/**
 * Mask overlay for click detection and element inspection.
 * Provides semi-transparent overlay that detects clicks and reports detailed element information.
 *
 * @remarks
 * Click detection:
 * - Uses elementFromPoint() API to detect underlying elements
 * - Temporarily hides mask overlay during detection
 * - Gathers comprehensive element information
 * - Traverses shadow DOM boundaries
 *
 * Visibility control:
 * - Listens to MASK_EVENTS.toggle from orchestrator
 * - Initially hidden (display: 'none')
 * - Toggles visibility with CSS class
 *
 * Element information captured:
 * - Coordinates (x, y)
 * - tagName, id, className
 * - All attributes
 * - textContent
 * - Shadow path (traversed shadow roots)
 *
 * Grid positioning:
 * - gridArea: 'content' (same as fixture)
 * - zIndex: 2 (overlays fixture at zIndex: 1)
 * - pointerEvents: 'none' on host, 'auto' on overlay
 *
 * @see {@link MASK_EVENTS.click} for emitted event with MaskClickDetail
 * @see {@link MASK_EVENTS.toggle} for visibility control
 * @see {@link MaskClickDetail} for event detail structure
 * @see {@link getShadowPath} for shadow DOM traversal
 */
export const PlaitedMask: FT = bElement({
  tag: 'plaited-mask',
  publicEvents: [MASK_EVENTS.toggle],
  shadowDom: (
    <div
      p-target='overlay'
      p-trigger={{ click: 'mask_click' }}
    />
  ),
  bProgram({ $, emit }) {
    const _isVisible = false

    return {
      // Toggle visibility handler - receives boolean directly
      [MASK_EVENTS.toggle](visible: boolean) {
        const overlay = $('overlay')[0]
        overlay?.attr('style', `display: ${visible ? 'block' : 'none'}`)
      },
      // Click handler using p-trigger pattern
      mask_click(event: Event) {
        const mouseEvent = event as MouseEvent
        const { clientX, clientY } = mouseEvent
        const overlay = $('overlay')[0]

        if (!overlay) return

        // Temporarily disable pointer-events for accurate detection
        overlay.attr('style', 'pointer-events: none')
        const target = document.elementFromPoint(clientX, clientY)
        overlay.attr('style', 'pointer-events: auto')

        if (!target) return

        const detail: MaskClickDetail = {
          x: clientX,
          y: clientY,
          tagName: target.tagName,
          id: target.id || null,
          className: target.className || null,
          attributes: Array.from(target.attributes).map((attr) => ({
            name: attr.name,
            value: attr.value,
          })),
          textContent: target.textContent,
          shadowPath: getShadowPath(target),
        }

        emit({ type: MASK_EVENTS.click, detail, bubbles: true })
      },
    }
  },
})
