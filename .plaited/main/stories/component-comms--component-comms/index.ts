
import { type PlaitedElement } from 'plaited'
import { PlaitedFixture } from 'plaited/testing'
import { canUseDOM} from 'plaited/utils'
import { componentComms } from '../../../../src/main/stories/component-comms.stories.tsx'
if(canUseDOM()) {
  await customElements.whenDefined(PlaitedFixture.tag)
  const fixture = document.querySelector<PlaitedElement>(PlaitedFixture.tag);
  fixture?.trigger({
    type: 'play',
    detail: {
      route: "/main/stories/component-comms--component-comms",
      entry: "/Users/eirby/Workspace/lab/plaited/src/main/stories/component-comms.stories.tsx",
      exportName: "componentComms",
      story: componentComms
    }
  });
}
