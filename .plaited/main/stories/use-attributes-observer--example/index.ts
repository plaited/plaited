
import { type PlaitedElement } from 'plaited'
import { PlaitedFixture } from 'plaited/testing'
import { canUseDOM} from 'plaited/utils'
import { Example } from '../../../../src/main/stories/use-attributes-observer.stories.tsx'
if(canUseDOM()) {
  await customElements.whenDefined(PlaitedFixture.tag)
  const fixture = document.querySelector<PlaitedElement>(PlaitedFixture.tag);
  fixture?.trigger({
    type: 'play',
    detail: {
      route: "/main/stories/use-attributes-observer--example",
      entry: "/Users/eirby/Workspace/lab/plaited/src/main/stories/use-attributes-observer.stories.tsx",
      exportName: "Example",
      story: Example
    }
  });
}
