import { bElement, bSync, bThread, createHostStyles, createStyles, joinStyles, type BehavioralElement, type FT } from 'plaited'
import { HEADER_EVENTS, MASK_EVENTS } from './testing.constants.ts'
import type { MaskClickDetail } from './testing.types.ts'
import { PlaitedHeader } from './plaited-header.tsx'
import { PlaitedMask } from './plaited-mask.tsx'
import { PlaitedFixture } from './plaited-fixture.tsx'
import { useReload } from './testing.utils.ts'

/**
 * Host styles for grid layout container.
 */
const orchestratorHostStyles = createHostStyles({
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
      <PlaitedHeader {...orchestratorStyles.headerSlot} />
      <PlaitedFixture {...orchestratorStyles.fixtureSlot}>
        <slot />
      </PlaitedFixture>
      <PlaitedMask
        {...orchestratorStyles.maskSlot}
      />
    </>
  ),
  bProgram({ trigger, inspector, $ }) {
    if (!window?.__PLAITED_RUNNER__) {
      inspector.on()
      const disconnectReload = useReload()
      trigger.addDisconnectCallback(disconnectReload)
    }

    bThread([
      bSync({ waitFor: HEADER_EVENTS.emit_toggle }),
      bSync({
        request: { type: MASK_EVENTS.toggle },
      })
    ], true)

    const mask = $<BehavioralElement>('mask')[0]!

    return {
      // // Forward toggle event from header to mask
      // [HEADER_EVENTS.emit_toggle](detail: boolean) {
      //   console.log('Orchestrator received toggle:', detail)
      //   mask.trigger({ type: MASK_EVENTS.toggle, detail })
      // },

      // // Log mask click events
      // [MASK_EVENTS.emit_click](detail: MaskClickDetail) {
      //   console.log('Mask clicked at:', detail)
      // },
    }
  },
})
 