
import { type PlaitedElement } from 'plaited'
import { PlaitedFixture } from 'plaited/testing'
import { canUseDOM} from 'plaited/utils'
import { checked } from '../../../../src/main/stories/decorated-element.stories.tsx'
if(canUseDOM()) {
  await customElements.whenDefined(PlaitedFixture.tag)
  const fixture = document.querySelector<PlaitedElement>(PlaitedFixture.tag);
  fixture?.trigger({
    type: 'play',
    detail: {
      route: "/main/stories/decorated-element--checked",
      entry: "/Users/eirby/Workspace/lab/plaited/src/main/stories/decorated-element.stories.tsx",
      exportName: "checked",
      story: checked
    }
  });
}
