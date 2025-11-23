import { story } from 'plaited/testing.ts'

// Story in deeply nested directory
export const deeplyNestedStory = story({
  description: 'A story in a deeply nested directory',
  template: () => <div>Deep Nested Story</div>,
})
