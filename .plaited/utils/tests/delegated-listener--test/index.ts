
import { type PlaitedElement } from 'plaited'
import { PlaitedFixture } from 'plaited/testing'
import { canUseDOM} from 'plaited/utils'
import { test } from '../../../../src/utils/tests/delegated-listener.stories.tsx'
if(canUseDOM()) {
  await customElements.whenDefined(PlaitedFixture.tag)
  const fixture = document.querySelector<PlaitedElement>(PlaitedFixture.tag);
  fixture?.trigger({
    type: 'play',
    detail: {
      route: "/utils/tests/delegated-listener--test",
      entry: "/Users/eirby/Workspace/lab/plaited/src/utils/tests/delegated-listener.stories.tsx",
      exportName: "test",
      story: test
    }
  });
}
