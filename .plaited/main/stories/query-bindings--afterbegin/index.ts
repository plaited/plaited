
import { type PlaitedElement } from 'plaited'
import { PlaitedFixture } from 'plaited/testing'
import { canUseDOM} from 'plaited/utils'
import { afterbegin } from '../../../../src/main/stories/query-bindings.stories.tsx'
if(canUseDOM()) {
  await customElements.whenDefined(PlaitedFixture.tag)
  const fixture = document.querySelector<PlaitedElement>(PlaitedFixture.tag);
  fixture?.trigger({
    type: 'play',
    detail: {
      route: "/main/stories/query-bindings--afterbegin",
      entry: "/Users/eirby/Workspace/lab/plaited/src/main/stories/query-bindings.stories.tsx",
      exportName: "afterbegin",
      story: afterbegin
    }
  });
}
