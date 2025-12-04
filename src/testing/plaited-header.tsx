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
    backgroundColor: 'white',
    color: 'black',

    ':hover': {
      backgroundColor: '#f3f4f6',
    },
    ':active': {
      backgroundColor: 'rgb(0, 123, 255)',
      color: 'white',
    },
  },
  buttonActive: {
    backgroundColor: 'rgb(0, 123, 255)',
    color: 'white',
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
  shadowDom: (
    <>
      <div {...headerStyles.container}>
        <button
          type='button'
          p-target='toggle-button'
          p-trigger={{ click: 'toggle' }}
          {...headerStyles.button}
        >
          Toggle Mask
        </button>
        <slot />
      </div>
      {headerHostStyles}
    </>
  ),
  bProgram({ $, trigger }) {
    const active = useSignal(false)

    return {
      toggle_mask() {
        const isActive = !active.get()
        active.set(isActive)
        const button = $('toggle-button')[0]
        if (button) {
          if (isActive) {
            button.attr('class', `${headerStyles.button} ${headerStyles.buttonActive}`)
          } else {
            button.attr('class', `${headerStyles.button}`)
          }
        }

        // Trigger public event
        trigger({ type: HEADER_EVENTS.toggle_mask, detail: isActive })
      },
    }
  },
})
