/**
 * Test fixture: Stories with .only() flag
 * Used to test filtering behavior in collect-stories.spec.ts
 */

import { story } from 'plaited/testing'

export const onlyStory = story.only({
  template: () => <div>Only story</div>,
  intent: 'Story marked with .only()',
})

export const regularStory = story({
  template: () => <div>Regular story</div>,
  intent: 'Regular story without .only()',
})

export const anotherRegularStory = story({
  template: () => <div>Another regular story</div>,
  intent: 'Another regular story',
})
