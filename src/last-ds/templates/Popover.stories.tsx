import { type StoryObj } from 'plaited/test'
import { DecoratedPopover } from './Popover.js'

export const Example: StoryObj = {
  template: () => (
    <DecoratedPopover>
      <button
        // popovertarget='my-popover'
        slot='popover-trigger'
      >
        Open Popover
      </button>

      <div
        // popover
        // id='my-popover'
        slot='popover-target'
      >
        Greetings, one and all!
      </div>
    </DecoratedPopover>
  ),
}
