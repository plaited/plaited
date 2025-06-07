
import { type PlaitedElement } from 'plaited'
import { PlaitedFixture } from 'plaited/testing'
import { canUseDOM} from 'plaited/utils'
import { checkbox } from '../../../../src/main/stories/form-associated-example.stories.tsx'
if(canUseDOM()) {
  await customElements.whenDefined(PlaitedFixture.tag)
  const fixture = document.querySelector<PlaitedElement>(PlaitedFixture.tag);
  fixture?.trigger({
    type: 'play',
    detail: {
      route: "/main/stories/form-associated-example--checkbox",
      entry: "/Users/eirby/Workspace/lab/plaited/src/main/stories/form-associated-example.stories.tsx",
      exportName: "checkbox",
      story: checkbox
    }
  });
}
