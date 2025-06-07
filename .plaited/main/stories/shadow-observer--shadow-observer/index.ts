
import { type PlaitedElement } from 'plaited'
import { PlaitedFixture } from 'plaited/testing'
import { canUseDOM} from 'plaited/utils'
import { shadowObserver } from '../../../../src/main/stories/shadow-observer.stories.tsx'
if(canUseDOM()) {
  await customElements.whenDefined(PlaitedFixture.tag)
  const fixture = document.querySelector<PlaitedElement>(PlaitedFixture.tag);
  fixture?.trigger({
    type: 'play',
    detail: {
      route: "/main/stories/shadow-observer--shadow-observer",
      entry: "/Users/eirby/Workspace/lab/plaited/src/main/stories/shadow-observer.stories.tsx",
      exportName: "shadowObserver",
      story: shadowObserver
    }
  });
}
