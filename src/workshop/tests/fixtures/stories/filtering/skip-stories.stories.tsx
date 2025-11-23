/**
 * Test fixture: Stories with .skip() flag
 * Used to test filtering behavior in collect-stories.spec.ts
 */

import { story } from '../../../../../testing/testing.fixture.tsx'

export const skippedStory = story.skip({
  template: () => <div>Skipped story</div>,
  description: 'Story marked with .skip()',
})

export const activeStory = story({
  template: () => <div>Active story</div>,
  description: 'Active story without .skip()',
})

export const anotherSkippedStory = story.skip({
  template: () => <div>Another skipped story</div>,
  description: 'Another skipped story',
})
