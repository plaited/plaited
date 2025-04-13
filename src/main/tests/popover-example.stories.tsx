import { type StoryObj } from 'plaited/testing'
import { DecoratedPopover, DecoratedPopoverClose } from './popover-example.js'

export const Example: StoryObj = {
  description: `renders a decorated popover`,
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
