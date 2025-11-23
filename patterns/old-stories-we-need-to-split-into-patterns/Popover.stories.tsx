import { story } from 'plaited/testing.ts'
import { DecoratedPopover, DecoratedPopoverClose } from './Popover.tsx'

export const Example = story({
  description: `A basic popover example with a trigger button and a close button within the popover target content.`,
  template: () => (
    <DecoratedPopover>
      <button
        type='button'
        slot='popover-trigger'
      >
        Open Popover
      </button>

      <div slot='popover-target'>
        Greetings, one and all!
        <DecoratedPopoverClose>
          <button type='button'>X</button>
        </DecoratedPopoverClose>
      </div>
    </DecoratedPopover>
  ),
})
