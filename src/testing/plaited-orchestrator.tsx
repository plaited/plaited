import { type BehavioralElement, bElement, createHostStyles, createStyles } from 'plaited'
import { PlaitedFixture } from './plaited-fixture.tsx'
import { PlaitedHeader } from './plaited-header.tsx'
import { PlaitedMask } from './plaited-mask.tsx'
import { FIXTURE_EVENTS, HEADER_EVENTS, MASK_EVENTS, STORY_ORCHESTRATOR } from './testing.constants.ts'
import type { InteractionStoryObj } from './testing.types.ts'
import { useReload } from './use-reload.ts'

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
export const PlaitedOrchestrator = bElement<{
  [FIXTURE_EVENTS.run]: {
    play?: InteractionStoryObj['play']
    timeout?: number
  }
}>({
  tag: STORY_ORCHESTRATOR,
  hostStyles: orchestratorHostStyles,
  shadowDom: (
    <>
      <PlaitedHeader
        p-trigger={{ [HEADER_EVENTS.emit_toggle]: 'mask_toggle' }}
        {...orchestratorStyles.headerSlot}
      />
      <PlaitedFixture
        {...orchestratorStyles.fixtureSlot}
        p-target='fixture'
      >
        <slot />
      </PlaitedFixture>
      <PlaitedMask
        p-target='mask'
        p-trigger={{ [MASK_EVENTS.emit_click]: 'emit_click' }}
        {...orchestratorStyles.maskSlot}
      />
    </>
  ),
  publicEvents: [FIXTURE_EVENTS.run],
  bProgram({ $, trigger, inspector }) {
    const mask = $<BehavioralElement>('mask')[0]!
    if (!window?.__PLAITED_RUNNER__) {
      inspector.on()
      const disconnectReload = useReload()
      trigger.addDisconnectCallback(disconnectReload)
    }
    const fixture = $<BehavioralElement>('fixture')[0]!
    return {
      // Forward toggle event from header to mask
      mask_toggle(detail: boolean) {
        mask.trigger({ type: MASK_EVENTS.toggle, detail })
      },

      // Log mask click events
      emit_click: () => {
        // Do something with mask click detail as needed
      },
      run(detail) {
        fixture.trigger({ type: FIXTURE_EVENTS.run, detail })
      },
    }
  },
})
