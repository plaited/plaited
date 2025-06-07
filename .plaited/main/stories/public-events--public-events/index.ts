
import { type PlaitedElement } from 'plaited'
import { PlaitedFixture } from 'plaited/testing'
import { canUseDOM} from 'plaited/utils'
import { publicEvents } from '../../../../src/main/stories/public-events.stories.tsx'
if(canUseDOM()) {
  await customElements.whenDefined(PlaitedFixture.tag)
  const fixture = document.querySelector<PlaitedElement>(PlaitedFixture.tag);
  fixture?.trigger({
    type: 'play',
    detail: {
      route: "/main/stories/public-events--public-events",
      entry: "/Users/eirby/Workspace/lab/plaited/src/main/stories/public-events.stories.tsx",
      exportName: "publicEvents",
      story: publicEvents
    }
  });
}
