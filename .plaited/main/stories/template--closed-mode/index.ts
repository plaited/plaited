
import { type PlaitedElement } from 'plaited'
import { PlaitedFixture } from 'plaited/testing'
import { canUseDOM} from 'plaited/utils'
import { closedMode } from '../../../../src/main/stories/template.stories.tsx'
if(canUseDOM()) {
  await customElements.whenDefined(PlaitedFixture.tag)
  const fixture = document.querySelector<PlaitedElement>(PlaitedFixture.tag);
  fixture?.trigger({
    type: 'play',
    detail: {
      route: "/main/stories/template--closed-mode",
      entry: "/Users/eirby/Workspace/lab/plaited/src/main/stories/template.stories.tsx",
      exportName: "closedMode",
      story: closedMode
    }
  });
}
