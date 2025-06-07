
import { type PlaitedElement } from 'plaited'
import { PlaitedFixture } from 'plaited/testing'
import { canUseDOM} from 'plaited/utils'
import { slots } from '../../../../src/main/stories/slots.stories.tsx'
if(canUseDOM()) {
  await customElements.whenDefined(PlaitedFixture.tag)
  const fixture = document.querySelector<PlaitedElement>(PlaitedFixture.tag);
  fixture?.trigger({
    type: 'play',
    detail: {
      route: "/main/stories/slots--slots",
      entry: "/Users/eirby/Workspace/lab/plaited/src/main/stories/slots.stories.tsx",
      exportName: "slots",
      story: slots
    }
  });
}
