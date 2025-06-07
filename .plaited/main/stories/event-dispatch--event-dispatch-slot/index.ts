
import { type PlaitedElement } from 'plaited'
import { PlaitedFixture } from 'plaited/testing'
import { canUseDOM} from 'plaited/utils'
import { eventDispatchSlot } from '../../../../src/main/stories/event-dispatch.stories.tsx'
if(canUseDOM()) {
  await customElements.whenDefined(PlaitedFixture.tag)
  const fixture = document.querySelector<PlaitedElement>(PlaitedFixture.tag);
  fixture?.trigger({
    type: 'play',
    detail: {
      route: "/main/stories/event-dispatch--event-dispatch-slot",
      entry: "/Users/eirby/Workspace/lab/plaited/src/main/stories/event-dispatch.stories.tsx",
      exportName: "eventDispatchSlot",
      story: eventDispatchSlot
    }
  });
}
