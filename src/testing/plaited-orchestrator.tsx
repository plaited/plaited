import { type BehavioralElement, bElement, createHostStyles, createStyles } from 'plaited'
import { PlaitedFixture } from './plaited-fixture.tsx'
import { PlaitedHeader } from './plaited-header.tsx'
import { PlaitedMask } from './plaited-mask.tsx'
import {
  FIXTURE_EVENTS,
  HEADER_EVENTS,
  MASK_EVENTS,
  ORCHESTRATOR_EVENTS,
  STORY_FIXTURE,
  STORY_HEADER,
  STORY_MASK,
  STORY_ORCHESTRATOR,
  UI_SNAPSHOT_EVENTS,
} from './testing.constants.ts'
import type { InitDetail } from './testing.types.ts'
import { uiInspector } from './ui-inspector.ts'
import { useWebSocket } from './use-web-socket.ts'

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
 * Orchestrator element for interactive testing.
 * Provides grid-based layout and event coordination between header, fixture, and mask elements.
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
 * - Coordinates MASK_EVENTS.toggle to mask element
 * - bThread pattern: waitFor header event � request mask event
 * - Repeats indefinitely for continuous coordination
 *
 * @see {@link HEADER_EVENTS.toggle_mask} for header toggle event
 * @see {@link MASK_EVENTS.toggle} for mask visibility control
 */
export const PlaitedOrchestrator = bElement<{
  [ORCHESTRATOR_EVENTS.init]: InitDetail
}>({
  tag: STORY_ORCHESTRATOR,
  hostStyles: orchestratorHostStyles,
  shadowDom: (
    <>
      <PlaitedHeader
        p-trigger={{ [HEADER_EVENTS.emit_toggle]: 'mask_toggle' }}
        p-target={STORY_HEADER}
        {...orchestratorStyles.headerSlot}
      />
      <PlaitedFixture
        {...orchestratorStyles.fixtureSlot}
        p-target={STORY_FIXTURE}
      >
        <slot />
      </PlaitedFixture>
      <PlaitedMask
        p-target={STORY_MASK}
        p-trigger={{ [MASK_EVENTS.emit_click]: 'emit_click' }}
        {...orchestratorStyles.maskSlot}
      />
    </>
  ),
  publicEvents: [ORCHESTRATOR_EVENTS.init],
  bProgram({ $, inspector, trigger }) {
    const fixture = $<BehavioralElement>(STORY_FIXTURE)[0]!
    const header = $<BehavioralElement>(STORY_HEADER)[0]!
    const mask = $<BehavioralElement>(STORY_MASK)[0]!
    return {
      // Forward toggle event from header to mask
      mask_toggle(detail: boolean) {
        mask.trigger({ type: MASK_EVENTS.toggle, detail })
      },

      // Log mask click events
      emit_click: () => {
        // Do something with mask click detail as needed
      },
      [ORCHESTRATOR_EVENTS.init](detail) {
        const send = useWebSocket(trigger)
        uiInspector({
          tag: STORY_ORCHESTRATOR,
          inspector,
          send,
          type: UI_SNAPSHOT_EVENTS.orchestrator_snapshot,
        })
        for (const el of [fixture, header, mask]) {
          el.trigger({ type: ORCHESTRATOR_EVENTS.connect_inspector, detail: send })
        }
        fixture.trigger({ type: FIXTURE_EVENTS.run, detail })
      },
    }
  },
})
