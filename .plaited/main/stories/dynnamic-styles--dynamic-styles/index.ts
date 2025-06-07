
import { type PlaitedElement } from 'plaited'
import { PlaitedFixture } from 'plaited/testing'
import { canUseDOM} from 'plaited/utils'
import { dynamicStyles } from '../../../../src/main/stories/dynnamic-styles.stories.tsx'
if(canUseDOM()) {
  await customElements.whenDefined(PlaitedFixture.tag)
  const fixture = document.querySelector<PlaitedElement>(PlaitedFixture.tag);
  fixture?.trigger({
    type: 'play',
    detail: {
      route: "/main/stories/dynnamic-styles--dynamic-styles",
      entry: "/Users/eirby/Workspace/lab/plaited/src/main/stories/dynnamic-styles.stories.tsx",
      exportName: "dynamicStyles",
      story: dynamicStyles
    }
  });
}
