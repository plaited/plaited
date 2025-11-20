/**
 * Test fixture: Stories with .only() flag
 * Used to test filtering behavior in collect-stories.spec.ts
 */

import { story } from '../../../../../testing/testing.fixture.js'

export const onlyStory = story.only({
  template: () => <div>Only story</div>,
  description: 'Story marked with .only()',
})

export const regularStory = story({
  template: () => <div>Regular story</div>,
  description: 'Regular story without .only()',
})

export const anotherRegularStory = story({
  template: () => <div>Another regular story</div>,
  description: 'Another regular story',
})
