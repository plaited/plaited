import { bElement, createHostStyles, createStyles, type FT } from 'plaited'
import { HEADER_EVENTS, MASK_EVENTS } from './testing.constants.ts'
import type { MaskClickDetail } from './testing.types.ts'

/**
 * Host styles for grid layout container.
 */
const _orchestratorHostStyles = createHostStyles({
  display: 'grid',
  gridTemplateRows: 'auto 1fr',
  gridTemplateAreas: '"header" "content"',
  width: '100%',
  minHeight: '400px',
})

const orchestratorStyles = createStyles({
  headerSlot: { gridArea: 'header' },
  fixtureSlot: { gridArea: 'content', zIndex: '1' },
  maskSlot: { gridArea: 'content', zIndex: '10' },
})

/**
 * Orchestrator component for interactive testing.
 * Provides grid-based layout and event coordination between header, fixture, and mask components.
 *
 * @remarks
 * Layout structure:
 * - Single-level CSS Grid on :host element
 * - Three named slots: 'header', 'fixture', 'mask'
 * - Fixture and mask occupy same grid area with z-index layering
 * - Header occupies top row (auto-sized)
 * - Content area fills remaining space (1fr)
 *
 * Grid configuration:
 * - gridTemplateRows: 'auto 1fr' (header auto, content fills)
 * - gridTemplateAreas: '"header" "content"'
 * - Header slot: gridArea: 'header'
 * - Fixture slot: gridArea: 'content', zIndex: 1
 * - Mask slot: gridArea: 'content', zIndex: 2 (overlays fixture)
 *
 * Event coordination via bThreads:
 * - Listens for HEADER_EVENTS.toggle_mask from header
 * - Coordinates MASK_EVENTS.toggle to mask component
 * - bThread pattern: waitFor header event � request mask event
 * - Repeats indefinitely for continuous coordination
 *
 * Components communicate through light DOM:
 * - Pure slot-based composition
 * - No component instances in shadow DOM
 * - Event flow: header � orchestrator � mask
 *
 * @see {@link HEADER_EVENTS.toggle_mask} for header toggle event
 * @see {@link MASK_EVENTS.toggle} for mask visibility control
 */
export const PlaitedOrchestrator: FT = bElement({
  tag: 'plaited-orchestrator',
  shadowDom: (
    <>
      <slot
        name='header'
        p-target='header-slot'
        {...orchestratorStyles.headerSlot}
      />
      <slot
        name='fixture'
        p-target='fixture-slot'
        {...orchestratorStyles.fixtureSlot}
      />
      <slot
        name='mask'
        p-target='mask-slot'
        {...orchestratorStyles.maskSlot}
      />
    </>
  ),
  bProgram({ bThread, bThreads, bSync, trigger }) {
    // Set up b-threads for event coordination
    bThreads.set({
      forwardToggle: bThread([
        bSync({ waitFor: HEADER_EVENTS.toggle_mask }),
        bSync({ request: { type: MASK_EVENTS.toggle } }),
      ]),
      logMaskClicks: bThread([
        bSync({ waitFor: MASK_EVENTS.click }),
        // Console logging handled in feedback method
      ]),
    })

    return {
      // Forward toggle event from header to mask
      [HEADER_EVENTS.toggle_mask](detail: boolean) {
        trigger({ type: MASK_EVENTS.toggle, detail })
      },
      // Log mask click details
      [MASK_EVENTS.click](_detail: MaskClickDetail) {},
    }
  },
})
