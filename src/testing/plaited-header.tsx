import { bElement, createHostStyles, createStyles, type FT, useSignal } from '../main.ts'
import { HEADER_EVENTS } from './testing.constants.ts'

/**
 * Button styles for the toggle button.
 * Provides white/blue state transitions with hover effects.
 */
const headerStyles = createStyles({
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
  },
  button: {
    padding: '0.5rem 1rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    backgroundColor: {
      $default: 'white',
      ':hover': 'rgb(0, 123, 255)',
      ':active': 'rgb(0, 123, 255)',
      '[data-active="true"]': 'rgb(0, 123, 255)',
    },
    color: {
      $default: 'black',
      ':active': 'white',
    }
  },
})

/**
 * Host styles for grid positioning.
 */
const headerHostStyles = createHostStyles({
  display: 'block',
  gridArea: 'header',
})

/**
 * Header control panel for interactive testing.
 * Provides toggle button to control mask visibility.
 *
 * @remarks
 * Features:
 * - Toggle button with visual state feedback (white → blue)
 * - Emits HEADER_EVENTS.toggle_mask with boolean detail
 * - Extensible via default slot for additional controls
 * - Grid positioning via gridArea: 'header'
 *
 * Visual feedback:
 * - Inactive: White background, gray border
 * - Active: Blue background, darker blue border
 * - Smooth transition between states
 *
 * @see {@link HEADER_EVENTS.toggle_mask} for emitted event
 */
export const PlaitedHeader: FT = bElement({
  tag: 'plaited-header',
  hostStyles: headerHostStyles,
  publicEvents: [HEADER_EVENTS.emit_toggle],
  shadowDom: (
    <>
      <div {...headerStyles.container}>
        <button
          type='button'
          p-target='toggle-button'
          p-trigger={{ click: 'toggle_mask' }}
          {...headerStyles.button}
        >
          Toggle Mask
        </button>
        <slot />
      </div>
    </>
  ),
  bProgram({ $, trigger }) {
    const button = $<HTMLButtonElement>('toggle-button')[0]
    let active = false

    return {
      toggle_mask() {
        // Toggle the state
        active = !active

        // Update button's visual state
        button?.attr('data-active', String(active))

        // Trigger the new state via bProgram event (not DOM event)
        trigger({ type: HEADER_EVENTS.emit_toggle, detail: active })
      },
    }
  },
})
