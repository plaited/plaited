/**
 * Test fixture: Multiple stories with .only() flags
 * Used to test that when multiple .only() exist, all .only() stories run
 */

import { story } from 'plaited/testing'

export const firstOnlyStory = story.only({
  template: () => <div>First only story</div>,
  intent: 'First story marked with .only()',
})

export const secondOnlyStory = story.only({
  template: () => <div>Second only story</div>,
  intent: 'Second story marked with .only()',
})

export const regularStory = story({
  template: () => <div>Regular story</div>,
  intent: 'Regular story that should be skipped',
})

export const skippedStory = story.skip({
  template: () => <div>Skipped story</div>,
  intent: 'Skipped story that should also be filtered out',
})
