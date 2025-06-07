
import { type PlaitedElement } from 'plaited'
import { PlaitedFixture } from 'plaited/testing'
import { canUseDOM} from 'plaited/utils'
import { delegatesFocusFalse } from '../../../../src/main/stories/template.stories.tsx'
if(canUseDOM()) {
  await customElements.whenDefined(PlaitedFixture.tag)
  const fixture = document.querySelector<PlaitedElement>(PlaitedFixture.tag);
  fixture?.trigger({
    type: 'play',
    detail: {
      route: "/main/stories/template--delegates-focus-false",
      entry: "/Users/eirby/Workspace/lab/plaited/src/main/stories/template.stories.tsx",
      exportName: "delegatesFocusFalse",
      story: delegatesFocusFalse
    }
  });
}
