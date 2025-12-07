import { bElement, bSync, bThread, createStyles, type BPEvent, type FT } from '../main.ts'
import { MASK_EVENTS } from './testing.constants.ts'
import type { MaskClickDetail } from './testing.types.ts'
import { getShadowPath } from './testing.utils.ts'

/**
 * Host styles for grid positioning and z-index layering.
 */
const maskStyles = createStyles({
  overlay: {
    display: {
      $default: 'none',
      ['data-visible="true"']: 'block',
    }, // Initially hidden
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    cursor: {
      $default: 'none',
      ['data-visible="true"']: 'crosshair',
    },
  }
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
export const PlaitedMask = bElement({
  tag: 'plaited-mask',
  publicEvents: [MASK_EVENTS.emit_click],
  shadowDom: (
    <div
      p-target='overlay'
      p-trigger={{ click: 'internal_click' }}
      {...maskStyles.overlay}
    />
  ),
  bProgram({ $, trigger }) {
    const overlay = $('overlay')[0]
    let _isVisible = false

    bThread([
      bSync({ waitFor: MASK_EVENTS.toggle }),
      bSync({
        request: ({ detail }: { detail: boolean }) => ({
          type: 'handle_toggle',
          detail,
        }),
      })
    ], true)

    return {
      // Handle visibility toggle from orchestrator
      handle_toggle(visible: boolean) {
        _isVisible = visible
        overlay?.attr('data-visible', String(_isVisible))
      },

      // Handle click detection and emit click event
      internal_click(event: Event) {
        const mouseEvent = event as MouseEvent
        const { clientX, clientY } = mouseEvent

        // Temporarily disable pointer-events for accurate detection
        overlay?.attr('style', 'pointer-events: none')
        const target = document.elementFromPoint(clientX, clientY)
        overlay?.attr('style', 'pointer-events: auto')

        if (!target) return

        const clickDetail: MaskClickDetail = {
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

        // Trigger bProgram event (not DOM event)
        trigger({ type: MASK_EVENTS.emit_click, detail: clickDetail })
      },
    }
  },
})
