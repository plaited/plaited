import { bElement, createHostStyles, createStyles } from '../main.ts'
import { MASK_EVENTS } from './testing.constants.ts'
import type { MaskClickDetail } from './testing.types.ts'

/**
 * Traverses from an element up through shadow DOM boundaries.
 * Returns the path of elements crossed including shadow hosts.
 *
 * @param element - Starting element to traverse from
 * @returns Array of elements in the shadow path (child to ancestor order)
 *
 * @remarks
 * - Used by mask click handler to capture shadow DOM structure
 * - Walks up through shadowRoot.host to cross shadow boundaries
 * - Returns empty array if element is null/undefined
 * - Array ordered from clicked element to topmost host
 */
export const getShadowPath = (element: Element | null): Element[] => {
  if (!element) return []

  const path: Element[] = [element]
  let current: Node | null = element

  while (current) {
    // Check if we're at a shadow root boundary
    const root: Node = (current as Element).getRootNode()
    if (root && root !== document && 'host' in root) {
      const host: Element = (root as ShadowRoot).host
      path.push(host)
      current = host
    } else {
      // Move up the regular DOM tree
      current = current.parentElement
      if (current && current !== document.documentElement) {
        path.push(current as Element)
      } else {
        break
      }
    }
  }

  return path
}

/**
 * Host styles for grid positioning and z-index layering.
 */
const maskHostStyles = createHostStyles({
  top: '0',
  left: '0',
  width: '100%',
  height: '100%',
})

const maskStyles = createStyles({
  overlay: {
    display: {
      $default: 'none',
      '[data-visible="true"]': 'block',
    },
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    cursor: {
      $default: 'none',
      '[data-visible="true"]': 'crosshair',
    },
    pointerEvents: {
      $default: 'none',
      '[data-visible="true"]': 'auto',
    },
  },
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
  publicEvents: [MASK_EVENTS.toggle],
  hostStyles: maskHostStyles,
  shadowDom: (
    <div
      p-target='overlay'
      p-trigger={{ click: 'emit_click' }}
      {...maskStyles.overlay}
    />
  ),
  bProgram({ $, emit, inspector }) {
    if (!window?.__PLAITED_RUNNER__) {
      inspector.on()
    }
    const overlay = $('overlay')[0]

    let _isVisible = false

    overlay?.attr('data-visible', String(_isVisible))

    return {
      [MASK_EVENTS.toggle](event) {
        _isVisible = event.detail
        overlay?.attr('data-visible', String(_isVisible))
      },

      // Handle click detection and emit click event
      emit_click(event: Event) {
        if (_isVisible) {
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
          emit({ type: MASK_EVENTS.emit_click, detail: clickDetail })
        }
      },
    }
  },
})
