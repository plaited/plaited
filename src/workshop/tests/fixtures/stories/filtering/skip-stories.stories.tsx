/**
 * Test fixture: Stories with .skip() flag
 * Used to test filtering behavior in collect-stories.spec.ts
 */

import { story } from 'plaited/testing'

export const skippedStory = story.skip({
  template: () => <div>Skipped story</div>,
  intent: 'Story marked with .skip()',
})

export const activeStory = story({
  template: () => <div>Active story</div>,
  intent: 'Active story without .skip()',
})

export const anotherSkippedStory = story.skip({
  template: () => <div>Another skipped story</div>,
  intent: 'Another skipped story',
})
