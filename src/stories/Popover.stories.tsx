import { type StoryObj } from 'plaited/workshop'
import { DecoratedPopover, DecoratedPopoverClose } from './Popover.js'

export const Example: StoryObj = {
  description: `A basic popover example with a trigger button and a close button within the popover target content.`,
  template: () => (
    <DecoratedPopover>
      <button slot='popover-trigger'>Open Popover</button>

      <div slot='popover-target'>
        Greetings, one and all!
        <DecoratedPopoverClose>
          <button>X</button>
        </DecoratedPopoverClose>
      </div>
    </DecoratedPopover>
  ),
}
